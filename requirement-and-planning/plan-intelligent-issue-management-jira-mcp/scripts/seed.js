const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function seedData() {
  console.log('🌱 Starting data seeding...');

  // Get table names from environment or use defaults
  const peopleTable = process.env.PEOPLE_TABLE || 'issue-mgmt-People';
  const configTable = process.env.CONFIG_TABLE || 'issue-mgmt-Config';

  try {
    // Seed people data
    console.log('📊 Seeding people data...');
    const peopleData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../seed/people.json'), 'utf8')
    );

    for (const person of peopleData) {
      await dynamodb.put({
        TableName: peopleTable,
        Item: person
      }).promise();
      console.log(`✅ Added person: ${person.name}`);
    }

    // Seed prioritization config
    console.log('⚙️  Seeding prioritization config...');
    const prioritizationConfig = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../seed/config.prioritization.json'), 'utf8')
    );

    await dynamodb.put({
      TableName: configTable,
      Item: prioritizationConfig
    }).promise();
    console.log('✅ Added prioritization config');

    // Seed severity matrix config
    console.log('🎯 Seeding severity matrix config...');
    const severityMatrixConfig = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../seed/config.severity-matrix.json'), 'utf8')
    );

    await dynamodb.put({
      TableName: configTable,
      Item: severityMatrixConfig
    }).promise();
    console.log('✅ Added severity matrix config');

    console.log('🎉 Seeding completed successfully!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
seedData().catch(console.error);
