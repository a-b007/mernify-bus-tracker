#!/usr/bin/env node
/**
 * Database Seed Script for Bengaluru Bus Digital Twin
 *
 * 1. Connects to MongoDB (process.env.MONGODB_URI or mongodb://localhost:27017/bus_twin)
 * 2. Creates all collections with indexes per docs/data-model.md
 * 3. Creates 'positions' time-series collection with TTL
 * 4. Imports stops.json, routes.json, buses.json
 * 5. Generates 7 days of synthetic stop_hourly_stats roll-ups
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root and server directory
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_twin';
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../../data');

console.log('=== BENGALURU BUS DIGITAL TWIN — SEED SCRIPT ===');
console.log(`MongoDB URI: ${MONGODB_URI}`);
console.log(`Data directory: ${DATA_DIR}\n`);

async function seed() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB successfully.');

    const db = client.db();

    // 1. Setup collections & indexes
    console.log('Setting up collections and indexes...');

    // stops: 2dsphere on loc, text on name
    const stopsCol = db.collection('stops');
    await stopsCol.createIndex({ loc: '2dsphere' });
    await stopsCol.createIndex({ name: 'text' });
    console.log('✓ stops indexes created');

    // routes: index on routeNo
    const routesCol = db.collection('routes');
    await routesCol.createIndex({ routeNo: 1 });
    console.log('✓ routes index created');

    // buses: indexes on routeId, type
    const busesCol = db.collection('buses');
    await busesCol.createIndex({ routeId: 1 });
    await busesCol.createIndex({ type: 1 });
    console.log('✓ buses indexes created');

    // bus_state: index on routeId, 2dsphere on loc
    const busStateCol = db.collection('bus_state');
    await busStateCol.createIndex({ routeId: 1 });
    await busStateCol.createIndex({ loc: '2dsphere' });
    console.log('✓ bus_state indexes created');

    // positions: Time-Series collection
    // config: timeField: ts, metaField: meta, granularity: seconds, expireAfterSeconds: 7200
    const existingCollections = await db.listCollections().toArray();
    const existingNames = new Set(existingCollections.map(c => c.name));

    if (!existingNames.has('positions')) {
      await db.createCollection('positions', {
        timeseries: {
          timeField: 'ts',
          metaField: 'meta',
          granularity: 'seconds'
        },
        expireAfterSeconds: 7200
      });
      console.log('✓ positions time-series collection created (TTL: 7200s)');
    } else {
      console.log('ℹ positions collection already exists, skipping creation');
    }

    // arrivals: UNIQUE (busId, tripId, stopId), (stopId, ts), TTL on ts = 48h (172800s)
    const arrivalsCol = db.collection('arrivals');
    await arrivalsCol.createIndex(
      { busId: 1, tripId: 1, stopId: 1 },
      { unique: true }
    );
    await arrivalsCol.createIndex({ stopId: 1, ts: 1 });
    await arrivalsCol.createIndex(
      { ts: 1 },
      { expireAfterSeconds: 172800 }
    );
    console.log('✓ arrivals indexes created (TTL: 172800s)');

    // stop_hourly_stats: UNIQUE (stopId, routeId, dayType, hour)
    const statsCol = db.collection('stop_hourly_stats');
    await statsCol.createIndex(
      { stopId: 1, routeId: 1, dayType: 1, hour: 1 },
      { unique: true }
    );
    console.log('✓ stop_hourly_stats unique index created');

    // alerts: TTL on ts = 3 days (259200s)
    const alertsCol = db.collection('alerts');
    try {
      await alertsCol.dropIndex('ts_1');
    } catch (e) {
      // index might not exist
    }
    await alertsCol.createIndex(
      { ts: 1 },
      { expireAfterSeconds: 259200 }
    );
    console.log('✓ alerts indexes created (TTL: 259200s)');

    // users: UNIQUE email
    const usersCol = db.collection('users');
    await usersCol.createIndex({ email: 1 }, { unique: true });
    console.log('✓ users unique email index created');

    // 2. Import data files
    console.log('\nImporting static data...');

    const stopsData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'stops.json'), 'utf8'));
    await stopsCol.deleteMany({});
    if (stopsData.length > 0) {
      await stopsCol.insertMany(stopsData, { ordered: false });
      console.log(`✓ Imported ${stopsData.length} stops`);
    }

    const routesData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'routes.json'), 'utf8'));
    await routesCol.deleteMany({});
    if (routesData.length > 0) {
      await routesCol.insertMany(routesData, { ordered: false });
      console.log(`✓ Imported ${routesData.length} routes`);
    }

    const busesData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'buses.json'), 'utf8'));
    await busesCol.deleteMany({});
    if (busesData.length > 0) {
      await busesCol.insertMany(busesData, { ordered: false });
      console.log(`✓ Imported ${busesData.length} buses`);
    }

    // 3. Generate 7 days of synthetic stop_hourly_stats roll-ups
    console.log('\nGenerating synthetic stop_hourly_stats roll-ups...');
    await statsCol.deleteMany({});

    const statsDocs = [];
    const DAY_TYPES = ['WEEKDAY', 'WEEKEND'];

    // Generate for each route and its stops
    for (const route of routesData) {
      const rId = route._id;
      for (const stop of route.stops) {
        const sId = stop.stopId;

        for (const dayType of DAY_TYPES) {
          // Bus operates typically between 05:00 and 23:00
          for (let hour = 5; hour <= 23; hour++) {
            // Peak hours: 8-11 and 17-20
            const isPeak = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 20);
            const isWeekend = dayType === 'WEEKEND';

            // Arrivals per hour for this route at this stop
            const baseFrequency = isWeekend ? 6 : (isPeak ? 12 : 8);
            const n = Math.max(3, Math.round(baseFrequency + (Math.random() * 4 - 2)));

            // Headway in seconds: ~3600 / n
            const avgHeadway = Math.round(3600 / n);
            const minHeadwayS = Math.max(120, Math.round(avgHeadway * 0.65));
            const maxHeadwayS = Math.round(avgHeadway * 1.4);
            const sumHeadwayS = avgHeadway * n;

            // Delay in seconds
            const avgDelay = isPeak ? 180 + Math.random() * 180 : 45 + Math.random() * 60;
            const sumDelayS = Math.round(avgDelay * n);

            statsDocs.push({
              stopId: sId,
              routeId: rId,
              dayType,
              hour,
              n,
              sumHeadwayS,
              sumDelayS,
              minHeadwayS,
              maxHeadwayS
            });
          }
        }
      }
    }

    // Insert in batches of 5000 to keep memory low
    const BATCH_SIZE = 5000;
    for (let i = 0; i < statsDocs.length; i += BATCH_SIZE) {
      const chunk = statsDocs.slice(i, i + BATCH_SIZE);
      await statsCol.insertMany(chunk, { ordered: false });
    }
    console.log(`✓ Inserted ${statsDocs.length} stop_hourly_stats roll-up documents`);

    console.log('\n🎉 Database seed completed successfully!');
  } catch (err) {
    console.error('❌ Error during seeding:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed();
}

export { seed };
