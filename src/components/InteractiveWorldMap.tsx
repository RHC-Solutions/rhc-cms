'use client';

import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { motion } from 'framer-motion';
import { FaMapMarkerAlt, FaGlobeAmericas } from 'react-icons/fa';
import L from 'leaflet';

interface Office {
  id: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
  description: string;
  active?: boolean;
  order?: number;
}

export default function InteractiveWorldMap() {
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch offices from API
  useEffect(() => {
    const fetchOffices = async () => {
      try {
        console.log('Fetching offices...');
        const response = await fetch('/api/cms/offices?active=true');
        console.log('Offices response:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('Offices data received:', data?.length || 0, 'offices');
          if (Array.isArray(data) && data.length > 0) {
            setOffices(data.sort((a: Office, b: Office) => (a.order ?? 0) - (b.order ?? 0)));
          } else {
            console.warn('No offices returned from API, using defaults');
            setOffices(getDefaultOffices());
          }
        } else {
          console.error('Failed to fetch offices: HTTP', response.status);
          setOffices(getDefaultOffices());
        }
      } catch (error) {
        console.error('Error fetching offices:', error);
        setOffices(getDefaultOffices());
      } finally {
        setLoading(false);
      }
    };

    fetchOffices();
  }, []);

  // Default offices for fallback
  const getDefaultOffices = (): Office[] => [
    {
      id: 'office-1',
      city: 'New York',
      country: 'United States',
      lat: 40.7128,
      lng: -74.0060,
      timezone: 'America/New_York',
      description: 'Headquarters',
      active: true,
      order: 1
    },
    {
      id: 'office-2',
      city: 'London',
      country: 'United Kingdom',
      lat: 51.5074,
      lng: -0.1278,
      timezone: 'Europe/London',
      description: 'European Office',
      active: true,
      order: 2
    },
    {
      id: 'office-3',
      city: 'Singapore',
      country: 'Singapore',
      lat: 1.3521,
      lng: 103.8198,
      timezone: 'Asia/Singapore',
      description: 'Asia-Pacific Office',
      active: true,
      order: 3
    }
  ];

  useEffect(() => {
    // Initialize map only when offices are loaded
    const container = document.getElementById('map-container');
    if (!container || mapInstance || offices.length === 0 || loading) {
      console.log('Skipping map init - container:', !!container, 'mapInstance:', !!mapInstance, 'offices:', offices.length, 'loading:', loading);
      return;
    }

    console.log('Initializing map with', offices.length, 'offices');

    // Create map
    const map = L.map('map-container', {
      center: [25, 0],
      zoom: 2.5,
      minZoom: 2,
      maxZoom: 18,
      dragging: true,
      touchZoom: true,
    });

    // Add OpenStreetMap tiles with dark theme
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 19,
    }).addTo(map);

    // Add custom styling
    const style = document.createElement('style');
    style.innerHTML = `
      .leaflet-container {
        background-color: #0a0e27;
        border-radius: 1rem;
        overflow: hidden;
      }
      .leaflet-control {
        background-color: rgba(15, 23, 42, 0.95) !important;
        border: 2px solid #00D9FF !important;
        border-radius: 0.5rem !important;
      }
      .leaflet-control-zoom-in, .leaflet-control-zoom-out {
        color: #00D9FF !important;
        font-weight: bold;
      }
      .leaflet-control-zoom-in:hover, .leaflet-control-zoom-out:hover {
        background-color: #00D9FF !important;
        color: #0a0e27 !important;
      }
    `;
    document.head.appendChild(style);

    // Add office markers
    offices.forEach((office) => {
      const marker = L.circleMarker([office.lat, office.lng], {
        radius: 12,
        fillColor: '#00D9FF',
        color: '#00ff88',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.8,
        className: 'office-marker',
      });

      marker.bindPopup(`
        <div style="background: #0f172a; border-radius: 0.5rem; padding: 12px; border: 2px solid #00D9FF; font-family: system-ui;">
          <p style="color: #00ff88; font-weight: bold; margin: 0 0 4px 0;">${office.city}</p>
          <p style="color: #00D9FF; margin: 0 0 4px 0; font-size: 0.875rem;">${office.country} • ${office.timezone}</p>
        </div>
      `, {
        className: 'custom-popup',
        autoClose: false,
      });

      marker.addTo(map);
    });

    // Draw connections between offices
    const polylineGroup = L.layerGroup();
    for (let i = 0; i < offices.length; i++) {
      for (let j = i + 1; j < offices.length; j++) {
        const line = L.polyline(
          [[offices[i].lat, offices[i].lng], [offices[j].lat, offices[j].lng]],
          {
            color: '#00D9FF',
            weight: 2,
            opacity: 0.3,
            dashArray: '5, 5',
            lineCap: 'round',
            lineJoin: 'round',
          }
        );
        polylineGroup.addLayer(line);
      }
    }
    polylineGroup.addTo(map);

    // Add pulsing animation to markers (GPU-composited)
    const style2 = document.createElement('style');
    style2.innerHTML = `
      @keyframes pulse {
        0% {
          transform: translate3d(0, 0, 0);
          filter: drop-shadow(0 0 0 rgba(0, 217, 255, 0.7));
        }
        70% {
          transform: translate3d(0, 0, 0);
          filter: drop-shadow(0 0 10px rgba(0, 217, 255, 0));
        }
        100% {
          transform: translate3d(0, 0, 0);
          filter: drop-shadow(0 0 0 rgba(0, 217, 255, 0));
        }
      }
      .office-marker {
        animation: pulse 2s infinite;
        will-change: filter, transform;
      }
    `;
    document.head.appendChild(style2);

    setMapInstance(map);

    return () => {
      // Don't remove map on unmount for performance
    };
  }, [offices, loading, mapInstance]);

  return (
    <section className="section-padding bg-dark relative overflow-hidden">
      <div className="absolute inset-0 bg-cyber-grid opacity-10" />
      
      <div className="container-custom relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="heading-lg mb-4 flex items-center justify-center gap-3">
            <FaGlobeAmericas className="text-cyber-green" />
            Global <span className="text-gradient">Presence</span>
          </h2>
          <p className="text-text-secondary text-xl max-w-3xl mx-auto">
            With offices across 4 continents, we provide round-the-clock support and local expertise to clients worldwide
          </p>
        </motion.div>

        {/* Interactive Map */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative w-full mb-8"
        >
          <div 
            id="map-container" 
            className="w-full rounded-2xl border-2 border-cyber-green/30 overflow-hidden"
            style={{ height: '500px', minHeight: '500px' }}
          />
        </motion.div>

        {/* Office Cards Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8"
        >
          {offices.map((office, idx) => (
            <motion.div
              key={office.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + idx * 0.08 }}
              className="card-dark text-center group hover:border-cyber-green transition-all cursor-default"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                <FaMapMarkerAlt className="mx-auto text-cyber-green" />
              </div>
              <a 
                href={`https://maps.google.com/maps/search/${office.city},${office.country}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-primary font-bold text-lg mb-1 hover:text-cyber-cyan transition-colors inline-block"
              >
                {office.city}
              </a>
              <p className="text-text-secondary text-sm mb-1">{office.country}</p>
              <p className="text-text-muted text-xs font-mono">{office.timezone}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="card-cyber text-center">
            <p className="text-4xl font-bold text-gradient mb-2">{offices.length}</p>
            <p className="text-text-secondary font-semibold">Global Offices</p>
            <p className="text-text-muted text-sm mt-1">Strategically Located</p>
          </div>
          <div className="card-cyber text-center">
            <p className="text-4xl font-bold text-gradient mb-2">24/7</p>
            <p className="text-text-secondary font-semibold">Support Coverage</p>
            <p className="text-text-muted text-sm mt-1">Round the Clock</p>
          </div>
          <div className="card-cyber text-center">
            <p className="text-4xl font-bold text-gradient mb-2">4</p>
            <p className="text-text-secondary font-semibold">Continents</p>
            <p className="text-text-muted text-sm mt-1">Worldwide Reach</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
