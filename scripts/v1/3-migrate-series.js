const fs = require('fs').promises;
const readline = require('readline');
const { network } = require("hardhat");

function waitInput(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve();
    }))
}

// {
//     companies(first: 1000, orderBy:creation) {
//         id
//         name
//         owner
//         jurisdiction
//         creator
//         creation
//     }
// }
  

async function main() {

    let jurisdictions = [];
    let controllers = [];
    let creations = [];
    let names = [];

    const jurisdictionDict = {
        "DAO": 0,
        "DELAWARE": 1,
        "WYOMING": 2
    }
    let deploysJson;
    let toMigrate;

    // Load deploy files created on 1-deploy-master.js
    try {
        const data = await fs.readFile(`./deploys/v1/${network.name}.json`, "utf-8");
        deploysJson = JSON.parse(data);
    } catch (err) {
        console.log('Error loading Master address: ', err);
        process.exit(1);
    }

    // Set master contract based on file loaded
    const OtoCoMaster = await ethers.getContractFactory("OtoCoMaster");
    const otocoMaster = OtoCoMaster.attach(deploysJson.master);

    // Import file with entities to be migrated.
    try {
        const data = await fs.readFile(`./migrations_data/companies.${network.name}.json`, "utf-8");
        toMigrate = JSON.parse(data);
    } catch (err) {
        toMigrate = { data: { companies: [] } }
        console.log(err);
    }

    // Set arrays with entity informations
    toMigrate.data.companies.map((s) => {
        jurisdictions.push(jurisdictionDict[s.jurisdiction]);
        names.push(s.name);
        creations.push(s.creation)
        controllers.push(s.owner);
    })

    // Verify if entities creation order are correct
    creations.reduce( (acc,c,idx) => {
        if (parseInt(acc) > parseInt(c)) throw `Entities not ordered by creation correctly. Entity at ${idx} is bigger than previous.`
        return c
    },"0")

    console.log('Entities to Migrate:', toMigrate.data.companies.length)
    await waitInput("Press enter to proceed...");

    // Migrate entities in slices
    // Require press enter before each migration so gives time to check if any problem occurs during migration.
    const slices = 100;
    for (let i = 0; i < jurisdictions.length; i += slices) {
        const transaction = await otocoMaster.createBatchSeries(
            jurisdictions.slice(i, i + slices),
            controllers.slice(i, i + slices),
            creations.slice(i, i + slices),
            names.slice(i, i + slices)
        );
        console.log("Gas spent migrating: ", (await transaction.wait()).cumulativeGasUsed.toString());
        console.log("ETH Spent: ", ethers.utils.formatEther((await transaction.wait()).cumulativeGasUsed.mul("50000000000")));
        console.log('')
        await waitInput("Press enter to proceed...");
    }

    console.log('🗺️  Total number of entities migrated: ', (await otocoMaster.seriesCount()).toNumber());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });