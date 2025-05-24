import { NextRequest, NextResponse } from 'next/server';
import neo4j, { Driver, Record as Neo4jRecord, Integer, isInt as neo4jIsInt, Neo4jError } from 'neo4j-driver';

const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USERNAME;
const password = process.env.NEO4J_PASSWORD;

if (!uri || !user || !password) {
  // Log this error to the server console during build or startup
  console.error('CRITICAL: Missing Neo4j credentials. Please check your .env.local file. App may not function correctly.');
  // We don't throw here to allow the app to build/start, but operations will fail.
}

let driver: Driver | null = null;

function getDriver(): Driver {
  if (!uri || !user || !password) {
    console.error('Neo4j credentials are not available. Cannot create driver.');
    throw new Error('Neo4j credentials are not configured.');
  }
  if (!driver) {
    try {
      driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      // Optional: Asynchronous verification after driver creation
      driver.verifyConnectivity()
        .then(() => console.log('Neo4j driver: Successfully verified connectivity to Neo4j AuraDB'))
        .catch((error: Error) => console.error('Neo4j driver: Connectivity verification failed:', error.message));
      console.log("Neo4j driver: Instance created.");
    } catch (error: any) {
      console.error('Neo4j driver: Failed to create instance:', error.message);
      throw new Error('Could not create Neo4j driver instance.'); // Re-throw to indicate critical failure
    }
  }
  return driver;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, params } = body;

    if (typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Query must be a non-empty string' }, { status: 400 });
    }

    const currentDriver = getDriver(); // This will throw if creds are missing or driver can't be created
    const session = currentDriver.session();
    console.log(`Executing Cypher Query: "${query}" with params:`, params || {});

    try {
      const result = await session.run(query, params || {});
      
      const records = result.records.map((record: Neo4jRecord) => {
        const obj: { [key: string]: any } = {};
        record.keys.forEach((key) => {
          if (typeof key === 'string') {
            const value = record.get(key);
            if (neo4jIsInt(value)) {
              obj[key] = (value as Integer).toNumber(); 
            } else if (value && typeof value === 'object' && 'identity' in value && 'labels' in value && 'properties' in value) {
              const nodeValue = value as any;
              obj[key] = {
                identity: neo4jIsInt(nodeValue.identity) ? (nodeValue.identity as Integer).toNumber() : nodeValue.identity,
                labels: nodeValue.labels,
                properties: nodeValue.properties
              };
            } else if (value && typeof value === 'object' && 'identity' in value && 'type' in value && 'properties' in value && 'start' in value && 'end' in value) {
              const relValue = value as any;
              obj[key] = {
                identity: neo4jIsInt(relValue.identity) ? (relValue.identity as Integer).toNumber() : relValue.identity,
                type: relValue.type,
                properties: relValue.properties,
                start: neo4jIsInt(relValue.start) ? (relValue.start as Integer).toNumber() : relValue.start,
                end: neo4jIsInt(relValue.end) ? (relValue.end as Integer).toNumber() : relValue.end
              };
            } else if (value instanceof Date) {
              obj[key] = value.toISOString();
            } else if (value && typeof value === 'object' && value.constructor.name === 'DateTime'){
              const dtValue = value as any;
              obj[key] = new Date(dtValue.year.toNumber(), dtValue.month.toNumber() -1, dtValue.day.toNumber(), dtValue.hour.toNumber(), dtValue.minute.toNumber(), dtValue.second.toNumber(), dtValue.nanosecond.toNumber() / 1000000).toISOString();
            } else if (value && typeof value === 'object' && value.constructor.name === 'Point'){
              const ptValue = value as any;
              obj[key] = {srid: ptValue.srid.toNumber(), x: ptValue.x, y: ptValue.y, z: ptValue.z };
            } else {
              obj[key] = value;
            }
          }
        });
        return obj;
      });

      // console.log("Query Results (Processed):", records);
      return NextResponse.json({ records });

    } catch (error: any) {
      const neo4jErrorCode = (error instanceof Neo4jError) ? error.code : 'N/A';
      console.error(`Error executing Cypher query "${query}":`, error.message, neo4jErrorCode !== 'N/A' ? `(Code: ${neo4jErrorCode})` : '');
      return NextResponse.json(
        { 
          error: 'Failed to execute Cypher query',
          details: error.message,
          neo4jError: neo4jErrorCode
        },
        { status: 500 }
      );
    } finally {
      await session.close();
    }
  } catch (error: any) {
    // Catches errors from req.json(), getDriver(), or other unexpected issues
    console.error('Invalid request or API setup error:', error.message);
    return NextResponse.json({ error: 'Invalid request or server configuration error', details: error.message }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
}

// Graceful shutdown for the driver (optional, good practice)
// This might not run reliably in all serverless environments but is good for local dev and some deployments.
async function cleanup() {
  if (driver) {
    console.log('Neo4j driver: Closing instance...');
    await driver.close();
    console.log('Neo4j driver: Instance closed.');
    driver = null;
  }
}

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
}); 