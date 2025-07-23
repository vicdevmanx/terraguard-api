import express from 'express';
import cors from 'cors';
import fs from 'fs';
import axios from 'axios';

const app = express();
app.use(cors());

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

const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
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
                console.log(`  - ${d.date} → ${d.rainAmount}mm`));
            // 👉 Here’s where you call your custom handler once:
            try {
                const sendMail = await axios.post('https://terra-guard-mailer.vercel.app/api/send-alert', {
                    location: info.communityName,
                    date: "2025-07-23",
                    percentage: 0
                })
                console.log(sendMail)
            }
            catch (e) {
                console.log(e)
            }
            // sendCustomFloodAlert(info);
        }
    }
}


// === Routes ===
let cachedGroupedData = null;

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
app.listen(PORT, () => {
    console.log(`🌧️  Flood Forecast API running at http://localhost:${PORT}/api/all`);
});
