// Cloudflare Pages Function for handling job applications
// This file will be deployed as a Cloudflare Worker

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    // Parse FormData
    const formData = await request.formData();
    const firstName = formData.get('firstName');
    const lastName = formData.get('lastName');
    const email = formData.get('email');
    const phone = formData.get('phone');
    const linkedin = formData.get('linkedin');
    const coverLetter = formData.get('coverLetter');
    const jobTitle = formData.get('jobTitle');
    const resumeFile = formData.get('resume');

    // Credentials come ONLY from the Cloudflare Pages environment bindings.
    // Never hardcode a bot token / chat id here — committed secrets get leaked
    // (see GitHub secret-scanning). Set TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID in
    // the Pages project settings (or .dev.vars locally).
    const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = env.TELEGRAM_CHAT_ID;
    if (!BOT_TOKEN || !CHAT_ID) {
      console.error('apply.js: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Application service is not configured.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Format message for Telegram
    const message = `
🎯 <b>New Job Application</b>

<b>Position:</b> ${jobTitle}

<b>Candidate Details:</b>
👤 <b>Name:</b> ${firstName} ${lastName}
📧 <b>Email:</b> ${email}
📱 <b>Phone:</b> ${phone}
💼 <b>LinkedIn:</b> ${linkedin}

<b>Cover Letter:</b>
${coverLetter}
`;

    // Send message to Telegram
    const messageResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!messageResponse.ok) {
      throw new Error('Failed to send message to Telegram');
    }

    // Send resume file if provided
    if (resumeFile && resumeFile.size > 0) {
      const formDataToSend = new FormData();
      formDataToSend.append('chat_id', CHAT_ID);
      formDataToSend.append('document', resumeFile);
      formDataToSend.append('caption', `Resume for ${firstName} ${lastName} - ${jobTitle}`);

      const fileResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: formDataToSend,
      });

      if (!fileResponse.ok) {
        console.error('Failed to send resume to Telegram');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Application submitted successfully!' 
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing application:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to submit application. Please try again.' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
