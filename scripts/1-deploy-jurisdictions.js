const fs = require('fs');
const { network } = require("hardhat");
const hre = require("hardhat");

const Reset = "\x1b[0m";
const Bright = "\x1b[1m";
const FgGreen = "\x1b[32m";
const FgRed = "\x1b[31m";
const FgCyan = "\x1b[36m";


async function main() {

    /*****************
     * GENERAL SETUP *
     *****************/

    const networkId = network.config.chainId;
    const [deployer] = await ethers.getSigners();

    let object = {}
    let badges = {}

    try {
        settings = JSON.parse(fs.readFileSync(
            "./scripts/v2/jurisdiction-settings.json",
            {encoding:"utf-8"},
        ));
    } catch (err) {
        console.log(
            `${FgRed}Error loading jurisdiction badges: ${err}${Reset}`
        );
		process.exit(1);
    }

    let unincorporated, delaware, wyoming;

    let settings
    switch (network.name) {
      case "mainnet": settings = jurisdictionSettings.mainnet; break;
      case "polygon": settings = jurisdictionSettings.polygon; break;
      default: settings = jurisdictionSettings.default; break;
    }
    
    /******************
     * USER PROMPTING *
     ******************/

    console.log(
        `\n${Bright}\t👤 Deploying contracts with ${FgCyan}${deployer.address}${Reset}`);

    const deployerBalance = 
        parseInt((await deployer.getBalance()).toString()) / 1e18;
    
    console.log(
        `\t${Bright}💰 Balance: ${FgCyan}${deployerBalance.toFixed(4)} ETH${Reset}\n`);

    const explorer = networkId == '1' ? 'Etherscan' : networkId == '137' ? 'Polygonscan' : null;
    
    if (explorer != null) {
        console.log(`${Bright} ${explorer} Gas Tracker Data: ${Reset}`);
        await hre.run("gas", { [network.name]: true });
    }

    /****************
     * ONCHAIN TASK *
     ****************/

    [unincorporated, delaware, wyoming] = 
    await hre.run( "jurisdictions", { settings: JSON.stringify(settings) });

    const jurisdictions = [unincorporated, delaware, wyoming];
    object.jurisdictions = jurisdictions.map(({ address }) => address);
    
    
    /******************
     * STORAGE CHECKS *
     ******************/

    const jurisdictionData = {};
    
    for (const jurisdiction of jurisdictions) {
        const renewalPrice = 
            (await jurisdiction.callStatic.getJurisdictionRenewalPrice()).toString();
        const deployPrice = 
            (await jurisdiction.callStatic.getJurisdictionDeployPrice()).toString();
        const name = 
            (await jurisdiction.callStatic.getJurisdictionName()).toString();
        const defaultBadge = 
            (await jurisdiction.callStatic.getJurisdictionBadge()).toString();
        const goldBadge = 
            (await jurisdiction.callStatic.getJurisdictionGoldBadge()).toString();
        jurisdictionData[jurisdiction.address] = 
            { renewalPrice, deployPrice, name, defaultBadge, goldBadge };
    }

    console.log(`${Bright}🚀 OtoCo V2 Jurisdictions Deployed:${Reset}`, jurisdictionData);

    fs.writeFileSync(
        `./deploys/v2/${network.name}.json`, 
        JSON.stringify(object, undefined, 2),
    );


    /**********************
     * SOURCE VERIFICATON *
     **********************/

    if (networkId != '31337') {
        for (const jurisdiction of jurisdictions) {
            await hre.run( "verification", { 
                addr: jurisdiction.address,
                args: JSON.stringify(
                        Object.values(jurisdictionData[jurisdiction.address])),
            });
        }
    }
}

main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});