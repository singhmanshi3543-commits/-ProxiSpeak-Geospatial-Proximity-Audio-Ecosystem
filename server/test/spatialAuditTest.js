import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import GeospatialEngine from '../src/services/geospatialEngine.js';

async function runAudit() {
  console.log('--- ProxiSpeak Spatial Audit Benchmark (Mid-Project Review) ---');
  try {
    await connectDB();
    const result = await GeospatialEngine.runSpatialAudit(50, 30, 100);

    console.log('\n================ AUDIT SUMMARY RESULTS ================');
    console.log(`Concurrent Users Tested:    ${result.metrics.concurrentUsers}`);
    console.log(`Earshot Radius:            ${result.metrics.earshotRadius} px`);
    console.log(`Iterations Executed:       ${result.metrics.totalIterations}`);
    console.log(`Average Query Latency:     ${result.metrics.avgLatencyMs} ms`);
    console.log(`P95 Query Latency:         ${result.metrics.p95LatencyMs} ms`);
    console.log(`Min Query Latency:         ${result.metrics.minLatencyMs} ms`);
    console.log(`Max Query Latency:         ${result.metrics.maxLatencyMs} ms`);
    console.log(`Clusters Formed:           ${result.metrics.clustersDetected}`);
    console.log(`Passed Sub-20ms Standard:  ${result.passed20msAudit ? 'YES (PASSED)' : 'NO (FAILED)'}`);
    console.log('========================================================\n');

    await mongoose.connection.close();
    process.exit(result.passed20msAudit ? 0 : 1);
  } catch (err) {
    console.error('Audit test failed:', err);
    process.exit(1);
  }
}

runAudit();
