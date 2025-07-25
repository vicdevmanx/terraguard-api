import express from 'express';
import cors from 'cors';
import fs from 'fs';
import axios from 'axios';
import { createServer } from 'http';
import { Server } from 'socket.io';

// === Setup Express + HTTP server + Socket.IO ===
const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' } // Open CORS for dev — lock this down for prod.
});

// === Socket.IO connection ===
io.on('connection', (socket) => {
  console.log('🚦 Client connected:', socket.id);
});
// === Precipitation buckets ===
const precipBuckets = [
    { max: 2, desc: 'Very light/drizzle', impact: 'Barely even wets the ground' },
    { max: 5, desc: 'Light rain', impact: 'Noticeable showers, damp roads' },
    { max: 20, desc: 'Moderate rain', impact: 'Surface run‑off begins' },
    { max: 50, desc: 'Heavy rain', impact: 'Risk of localized flooding' },
    { max: Infinity, desc: 'Torrential', impact: 'High flood risk' },
];

function precipitationDescriptor(mm) {
    const bucket = precipBuckets.find(b => mm <= b.max);
    return `${bucket.desc}, ${bucket.impact}`;
}

function scoreForecastDay(day, hours, baseRisk) {
    let score = baseRisk === 'High' ? 50 : 20;
    const rain = day.totalprecip_mm;
    if (rain > 80) score += 30;
    else if (rain > 50) score += 20;
    else if (rain > 30) score += 10;

    const heavyHours = hours.filter(h => h.precip_mm > 5).length;
    score += heavyHours * 2;
    if (day.avghumidity > 80) score += 5;
    if (day.cloud > 70) score += 3;
    if (day.maxwind_kph > 50) score += 5;
    if (day.condition.code >= 200 && day.condition.code < 300) score += 10;
    if (day.uv < 2) score += 5;

    return Math.min(score, 100);
}

function dayConfidence(day, hours) {
    let conf = 60;
    const rainVals = hours.map(h => h.precip_mm);
    const variation = Math.max(...rainVals) - Math.min(...rainVals);
    if (variation < 2) conf += 10;
    if (day.daily_chance_of_rain > 80) conf += 10;
    if (day.condition.code >= 200 && day.condition.code < 300) conf += 5;
    return Math.min(conf, 100);
}

function analyzeForecastDay(day, hours, baseRisk) {
    const floodProbability = scoreForecastDay(day, hours, baseRisk);
    const predictionAccuracy = dayConfidence(day, hours);
    const totalPrecipitation = day.totalprecip_mm;
    const heavyHourCount = hours.filter(h => h.precip_mm > 5).length;
    const precipitationDesc = precipitationDescriptor(totalPrecipitation);

    return {
        date: day.date,
        totalPrecipitation,
        precipitationDescriptor: precipitationDesc,
        heavyHourCount,
        floodProbability,
        predictionAccuracy,
    };
}

function predict3DayFlood(forecastObj, baseRisk) {
    return forecastObj.forecast.forecastday.map(block =>
        analyzeForecastDay({ ...block.day, date: block.date }, block.hour, baseRisk)
    );
}


const jsonData = {
  "low_risk": [
    {
      "LGA": "Abi",
      "risk": "Low",
      "communities": [
        {
          "name": "Itigidi",
          "lat": 5.7997,
          "lng": 8.0333,
          "risk": "Low"
        },
        {
          "name": "Ediba",
          "lat": 5.6833,
          "lng": 8.0667,
          "risk": "Low"
        },
        {
          "name": "Imabana 1",
          "lat": 5.7167,
          "lng": 8.1167,
          "risk": "Low"
        },
        {
          "name": "Ebom-Ebi Jakara",
          "lat": 5.72,
          "lng": 8.12,
          "risk": "Low"
        },
        {
          "name": "Afafanyi",
          "lat": 5.75,
          "lng": 8.1,
          "risk": "Low"
        },
        {
          "name": "Abayong",
          "lat": 5.77,
          "lng": 8.09,
          "risk": "Low"
        }
      ]
    },
    {
      "LGA": "Ikom",
      "risk": "Low",
      "communities": [
        {
          "name": "Ikom 1",
          "lat": 5.9667,
          "lng": 8.7167,
          "risk": "Low"
        },
        {
          "name": "Ikom 2",
          "lat": 5.9767,
          "lng": 8.7267,
          "risk": "Low"
        },
        {
          "name": "Olulumo",
          "lat": 5.976,
          "lng": 8.7,
          "risk": "Low"
        },
        {
          "name": "Ajassor",
          "lat": 5.97,
          "lng": 8.73,
          "risk": "Low"
        },
        {
          "name": "Ajere",
          "lat": 5.98,
          "lng": 8.735,
          "risk": "Low"
        },
        {
          "name": "Itaka",
          "lat": 5.955,
          "lng": 8.72,
          "risk": "Low"
        },
        {
          "name": "Mkpot",
          "lat": 5.95,
          "lng": 8.71,
          "risk": "Low"
        },
        {
          "name": "Osopong 1",
          "lat": 6.0,
          "lng": 8.74,
          "risk": "Low"
        },
        {
          "name": "Osopong 2",
          "lat": 6.01,
          "lng": 8.75,
          "risk": "Low"
        },
        {
          "name": "Azuabe",
          "lat": 6.02,
          "lng": 8.76,
          "risk": "Low"
        }
      ]
    },
    {
      "LGA": "Obubra",
      "risk": "Low",
      "communities": [
        {
          "name": "Obubra Urban",
          "lat": 6.0833,
          "lng": 8.3333,
          "risk": "Low"
        },
        {
          "name": "Ofodua",
          "lat": 6.1,
          "lng": 8.35,
          "risk": "Low"
        },
        {
          "name": "Ofumbongha-Yala",
          "lat": 6.11,
          "lng": 8.36,
          "risk": "Low"
        },
        {
          "name": "Ekureku 1",
          "lat": 6.12,
          "lng": 8.37,
          "risk": "Low"
        },
        {
          "name": "Ekureku 2",
          "lat": 6.13,
          "lng": 8.38,
          "risk": "Low"
        },
        {
          "name": "Echara",
          "lat": 6.14,
          "lng": 8.39,
          "risk": "Low"
        },
        {
          "name": "Enyibuchiri",
          "lat": 6.15,
          "lng": 8.4,
          "risk": "Low"
        },
        {
          "name": "Ekim-Effraya",
          "lat": 6.16,
          "lng": 8.41,
          "risk": "Low"
        },
        {
          "name": "Ofutop 1",
          "lat": 6.17,
          "lng": 8.42,
          "risk": "Low"
        }
      ]
    },
    {
      "LGA": "Yala",
      "risk": "Low",
      "communities": [
        {
          "name": "Yala Nkum",
          "lat": 6.7,
          "lng": 8.5,
          "risk": "Low"
        },
        {
          "name": "Ovonum",
          "lat": 6.71,
          "lng": 8.51,
          "risk": "Low"
        },
        {
          "name": "Adokpa",
          "lat": 6.72,
          "lng": 8.52,
          "risk": "Low"
        },
        {
          "name": "Nta-Nselle",
          "lat": 6.73,
          "lng": 8.53,
          "risk": "Low"
        }
      ]
    },
    {
      "LGA": "Boki",
      "risk": "Low",
      "communities": [
        {
          "name": "Assiga",
          "lat": 5.65,
          "lng": 8.5,
          "risk": "Low"
        }
      ]
    },
    {
      "LGA": "Akamkpa",
      "risk": "Low",
      "communities": [
        {
          "name": "Akamkpa",
          "lat": 5.4,
          "lng": 8.35,
          "risk": "Low"
        },
        {
          "name": "Uyanga",
          "lat": 5.35,
          "lng": 8.3,
          "risk": "Low"
        },
        {
          "name": "Betem",
          "lat": 5.37,
          "lng": 8.32,
          "risk": "Low"
        }
      ]
    },
    {
      "LGA": "Bakassi",
      "risk": "Low",
      "communities": [
        {
          "name": "Ikang",
          "lat": 4.9333,
          "lng": 8.5,
          "risk": "Low"
        }
      ]
    },
    {
      "LGA": "Calabar Municipality",
      "risk": "Low",
      "communities": [
        {
          "name": "Henshaw Town",
          "lat": 4.95,
          "lng": 8.322,
          "risk": "Low"
        },
        {
          "name": "Creek Town 1",
          "lat": 5.0167,
          "lng": 8.35,
          "risk": "Low"
        },
        {
          "name": "Ikoneto",
          "lat": 5.03,
          "lng": 8.36,
          "risk": "Low"
        },
        {
          "name": "Adiabo Efut",
          "lat": 5.02,
          "lng": 8.355,
          "risk": "Low"
        },
        {
          "name": "Eyo Bassey",
          "lat": 5.01,
          "lng": 8.345,
          "risk": "Low"
        }
      ]
    },
    {
      "LGA": "Calabar South",
      "risk": "Low",
      "communities": [
        {
          "name": "Anantigha",
          "lat": 4.955,
          "lng": 8.325,
          "risk": "Low"
        }
      ]
    },
    {
      "LGA": "Etung",
      "risk": "Low",
      "communities": [
        {
          "name": "Ekajuk 2",
          "lat": 6.2,
          "lng": 8.8,
          "risk": "Low"
        }
      ]
    }
  ],
  "high_risk": [
    {
      "LGA": "Obubra",
      "risk": "High",
      "communities": [
        {
          "name": "Ndiegu Echara 1",
          "lat": 6.15,
          "lng": 8.41,
          "risk": "High"
        },
        {
          "name": "Ndiegu Echara 2",
          "lat": 6.16,
          "lng": 8.42,
          "risk": "High"
        },
        {
          "name": "Ndiegu Inyimegu",
          "lat": 6.17,
          "lng": 8.43,
          "risk": "High"
        },
        {
          "name": "Ndiegu Amegu 2",
          "lat": 6.18,
          "lng": 8.44,
          "risk": "High"
        }
      ]
    },
    {
      "LGA": "Abi",
      "risk": "High",
      "communities": [
        {
          "name": "Adadama",
          "lat": 5.7,
          "lng": 8.0,
          "risk": "High"
        }
      ]
    },
    {
      "LGA": "Etung",
      "risk": "High",
      "communities": [
        {
          "name": "Gabu",
          "lat": 6.7,
          "lng": 8.8,
          "risk": "High"
        }
      ]
    },
    {
      "LGA": "Yala",
      "risk": "High",
      "communities": [
        {
          "name": "Osopong 1",
          "lat": 6.0,
          "lng": 8.74,
          "risk": "High"
        },
        {
          "name": "Osopong 2",
          "lat": 6.01,
          "lng": 8.75,
          "risk": "High"
        }
      ]
    },
    {
      "LGA": "Boki",
      "risk": "High",
      "communities": [
        {
          "name": "Nsofang",
          "lat": 6.25,
          "lng": 8.65,
          "risk": "High"
        }
      ]
    }
  ]
}
const data = jsonData;
const flatList = [...data.low_risk, ...data.high_risk]
    .flatMap(group => group.communities.map(c => ({ ...c, LGA: group.LGA, risk: group.risk })));

// === External API ===
const WEATHER_API_KEY = '4e0fa5645cf8441fa2d231734252207';

async function fetchAndPredict(community) {
    const url = `http://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}`
        + `&q=${community.lat},${community.lng}&days=3`;
    const resp = await axios.get(url);
    return {
        name: community.name,
        LGA: community.LGA,
        lat: community.lat,
        lng: community.lng,
        risk: community.risk,
        dailyForecast: predict3DayFlood(resp.data, community.risk),
    };
}

async function buildGrouped() {
    const grouped = {};
    for (const comm of flatList) {
        try {
            const out = await fetchAndPredict(comm);
            if (!grouped[out.LGA]) grouped[out.LGA] = [];
            grouped[out.LGA].push(out);
        } catch (e) {
            console.error(`Error for ${comm.name}:`, e.message);
        }
    }
    return grouped;
}

// === ✅ YOUR CUSTOM FLOOD CHECK ===
async function runCustomFloodAlertCheck(groupedData) {
  const floodRisks = {};
  console.log('func hitted')

  for (const [lgaName, communities] of Object.entries(groupedData)) {
    for (const community of communities) {
      const riskyDates = [];

      for (const day of community.dailyForecast) {
        const rain = day.totalPrecipitation;
        const risk = community.risk;

        if (
          (risk === 'Low' && rain > 5) ||
          (risk === 'Medium' && rain >= 30 && rain <= 50) ||
          (risk === 'High' && rain >= 20 && rain <= 30)
        ) {
          riskyDates.push({
            date: day.date,
            rainAmount: rain,
          });
        }
      }

      if (riskyDates.length > 0) {
        const key = `${community.name}_${lgaName}`;
        if (!floodRisks[key]) {
          floodRisks[key] = {
            communityName: community.name,
            LGA: lgaName,
            risk: community.risk,
            lat: community.lat,
            lng: community.lng,
            dates: [],
          };
        }
        floodRisks[key].dates.push(...riskyDates);
      }
    }
  }

  if (Object.keys(floodRisks).length === 0) {
    console.log('✅ No flood risks detected right now!');
  } else {
    for (const [key, info] of Object.entries(floodRisks)) {
      console.log(`⚠️ ALERT for ${info.communityName} (${info.LGA}) [${info.risk} risk]:`);
      info.dates.forEach(d =>
        console.log(`  - ${d.date} → ${d.rainAmount}mm`)
      );

      // ✅ Send mail
      try {
        const sendMail = await axios.post('https://terra-guard-mailer.vercel.app/api/send-alert', {
          location: info.communityName,
          date: info.dates,
          percentage: info.risk
        });
        console.log(sendMail);
      } catch (e) {
        console.log(e);
      }

      // ✅ ALSO EMIT to frontends:
      io.emit('flood-alert', info);
    }
  }
}


// === Routes ===
let cachedGroupedData = null;

app.get('/', (req, res) => {
    res.json({message: 'welcome to terraguard'})
})

app.get('/api/all', async (req, res) => {
    try {
        if (!cachedGroupedData) {
            cachedGroupedData = await buildGrouped();
        }
        // ✅ Trigger your custom flood check!
        runCustomFloodAlertCheck(cachedGroupedData);
        res.json(cachedGroupedData);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

app.get('/api/lga/:lgaName', async (req, res) => {
    try {
        const lgaName = req.params.lgaName;
        if (!cachedGroupedData) {
            cachedGroupedData = await buildGrouped();
        }
        const lgaData = cachedGroupedData[lgaName];
        if (!lgaData) {
            return res.status(404).json({ error: 'LGA not found' });
        }
        res.json(lgaData);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch LGA data' });
    }
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`🌧️  Flood Forecast API running with Socket.IO at http://localhost:${PORT}`);
});