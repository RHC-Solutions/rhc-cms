import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getSecret } from '@/lib/env';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiToken = getSecret('CLOUDFLARE_API_TOKEN');
    const zoneId = process.env.NEXT_PUBLIC_CLOUDFLARE_ZONE_ID;
    const accountId = getSecret('CLOUDFLARE_ACCOUNT_ID');

    console.log('Cloudflare API - credentials check:', {
      apiToken: apiToken ? `${apiToken.substring(0, 10)}...` : 'MISSING',
      zoneId: zoneId ? `${zoneId.substring(0, 8)}...` : 'MISSING',
      accountId: accountId ? `${accountId.substring(0, 8)}...` : 'MISSING'
    });

    if (!apiToken || !zoneId) {
      return NextResponse.json({
        error: 'Cloudflare credentials not configured. Open /admin/cloudflare/setup to add them.'
      }, { status: 400 });
    }

    const headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };

    // Fetch zone information
    const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, { headers });
    const zoneData = await zoneResponse.json();

    console.log('Cloudflare zone API:', zoneResponse.status, zoneData.success);

    if (!zoneResponse.ok || !zoneData.success) {
      console.error('Cloudflare API error:', zoneData);
      return NextResponse.json({ 
        error: `Cloudflare Error: ${zoneData.errors?.[0]?.message || 'Check credentials'}` 
      }, { status: 500 });
    }

    // Check account plan to determine if analytics are available
    const planId = zoneData.result?.plan?.id;
    const planName = zoneData.result?.plan?.name;
    const isFreeAccount = planName === 'Free Website' || planId === '0feeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    
    console.log(`Cloudflare account plan: ${planName} (${planId}) - Free: ${isFreeAccount}`);

    // Analytics APIs are only available on paid plans
    // Free accounts need to upgrade for analytics access
    let analyticsData: any = {
      requests: 0,
      bandwidth: 0,
      threats: 0,
      pageviews: 0,
      note: isFreeAccount ? 'Analytics require a paid Cloudflare plan (Pro or above)' : undefined,
    };

    // Only attempt analytics if not on Free plan
    if (!isFreeAccount) {
      try {
        const graphqlQuery = {
          query: `query {
            viewer {
              zones(filter: {zoneTag: "${zoneId}"}) {
                httpRequestsAdaptiveGroups(limit: 1, filter: {}) {
                  sum {
                    visits
                    edgeRequestBytes
                    edgeResponseBytes
                  }
                }
              }
            }
          }`
        };

        const graphqlResponse = await fetch(
          'https://api.cloudflare.com/client/v4/graphql',
          {
            method: 'POST',
            headers,
            body: JSON.stringify(graphqlQuery)
          }
        );
        const graphqlData = await graphqlResponse.json();
        
        console.log('Cloudflare GraphQL API:', graphqlResponse.status);
        
        if (graphqlData.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups?.[0]?.sum) {
          const sum = graphqlData.data.viewer.zones[0].httpRequestsAdaptiveGroups[0].sum;
          
          analyticsData = {
            requests: sum.visits || 0,
            bandwidth: sum.edgeResponseBytes ? Math.round(sum.edgeResponseBytes / 1024 / 1024) : 0,
            threats: 0,
            pageviews: sum.visits || 0,
          };
          
          console.log('✓ Got analytics from GraphQL:', analyticsData);
        }
      } catch (graphqlErr) {
        console.error('GraphQL API failed:', graphqlErr);
      }
    }

    // Fetch security events
    console.log('Fetching security events from Cloudflare...');
    
    let events: any[] = [];
    
    // Try GraphQL API for firewall events (more reliable)
    if (!isFreeAccount && accountId) {
      try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const firewallQuery = {
          query: `query {
            viewer {
              zones(filter: {zoneTag: "${zoneId}"}) {
                firewallEventsAdaptive(
                  filter: {
                    datetime_geq: "${oneDayAgo.toISOString()}"
                    datetime_leq: "${now.toISOString()}"
                  }
                  limit: 100
                  orderBy: [datetime_DESC]
                ) {
                  action
                  clientIP
                  datetime
                  source
                  userAgent
                  rayName
                }
              }
            }
          }`
        };

        const firewallResponse = await fetch(
          'https://api.cloudflare.com/client/v4/graphql',
          {
            method: 'POST',
            headers,
            body: JSON.stringify(firewallQuery)
          }
        );
        
        const firewallData = await firewallResponse.json();
        
        console.log('Firewall events GraphQL response:', {
          status: firewallResponse.status,
          hasData: !!firewallData.data,
          errors: firewallData.errors
        });
        
        if (firewallData.data?.viewer?.zones?.[0]?.firewallEventsAdaptive) {
          events = firewallData.data.viewer.zones[0].firewallEventsAdaptive;
          console.log(`✓ Got ${events.length} firewall events from GraphQL`);
        }
      } catch (graphqlErr) {
        console.error('GraphQL firewall events failed:', graphqlErr);
      }
    }
    
    // Fallback to REST API if GraphQL didn't work
    if (events.length === 0) {
      const eventsResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/security/events?per_page=100`,
        { headers }
      );
      const eventsData = await eventsResponse.json();
      
      console.log('Security events REST API response:', {
        status: eventsResponse.status,
        success: eventsData.success,
        resultCount: eventsData.result?.length || 0,
        errors: eventsData.errors,
        messages: eventsData.messages
      });

      if (!eventsData.success && eventsData.errors) {
        console.error('Cloudflare security events errors:', eventsData.errors);
      }
      
      events = eventsData.success ? (eventsData.result || []) : [];
    }

    console.log(`Final security events count: ${events.length}`);

    // Fetch DNS records
    const dnsResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=50`,
      { headers }
    );
    const dnsData = await dnsResponse.json();

    // Use analytics data with plan note if present
    const analytics = analyticsData as any;

    return NextResponse.json({
      zone: zoneData.result,
      analytics,
      events: events,
      dns: dnsData.success ? dnsData.result : [],
      accountId: accountId, // Pass account ID to client for dashboard link
    });

  } catch (error) {
    console.error('Error fetching Cloudflare data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'purge-cache') {
      const apiToken = getSecret('CLOUDFLARE_API_TOKEN');
      const zoneId = process.env.NEXT_PUBLIC_CLOUDFLARE_ZONE_ID;

      if (!apiToken || !zoneId) {
        return NextResponse.json({ 
          error: 'Cloudflare credentials not configured' 
        }, { status: 400 });
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ purge_everything: true }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error('Cloudflare purge error:', data);
        return NextResponse.json({ 
          error: 'Failed to purge cache' 
        }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Cache purged successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in Cloudflare POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
