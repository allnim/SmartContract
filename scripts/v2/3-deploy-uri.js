const fs = require('fs');
const { network } = require("hardhat");

const Reset = "\x1b[0m";
const Bright = "\x1b[1m";

const FgRed = "\x1b[31m";
const FgGreen = "\x1b[32m";
const FgMagenta = "\x1b[35m";
const FgCyan = "\x1b[36m";

async function main() {

  let deploysJson;

	// Load deployed master contract
	try {
		const data = fs.readFileSync(`./deploys/v2/${network.name}.json`, {encoding:"utf-8"});
		deploysJson = JSON.parse(data);
	} catch (err) {
		console.log(`${FgRed}Error loading Master address: ${err}${Reset}`);
		process.exit(1);
	}

  const OtocoMaster = await ethers.getContractFactory("OtoCoMasterV2");
  const otocoMaster = OtocoMaster.attach(deploysJson.master);

  const EntityURI = await ethers.getContractFactory("OtoCoURI");
  const entityURI = await EntityURI.deploy(otocoMaster.address);
  await entityURI.deployed();
  
  await otocoMaster.changeURISources(entityURI.address);
  const returnedAddress = await otocoMaster.callStatic.entitiesURI(); 

  const [deployer] = await ethers.getSigners();
  console.log(`${Bright}👤 Contract deployed with ${deployer.address}${Reset}`, "\n");

  if(returnedAddress === entityURI.address) {
    console.log(`${Bright}🚀 URI Source has been updated correctly!${Reset}
      Deployed Address: ${FgMagenta}${entityURI.address}${Reset}`);
  } else {
    console.log(`${Bright}URI Source address differs from the expected!${Reset}
      ${FgCyan}Expected: ${FgGreen}${entityURI.address}
      ${FgCyan}Actual: ${FgRed}${returnedAddress}`
    );
  }

	deploysJson.uri = entityURI.address;

	fs.writeFileSync(`./deploys/v2/${network.name}.json`, JSON.stringify(deploysJson, undefined, 2));
}

main()
.then(() => process.exit(0))
.catch((error) => {
	console.error(error);
	process.exit(1);
});