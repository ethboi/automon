const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying AutoMonEscrow with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "MON");

  const AutoMonEscrow = await hre.ethers.getContractFactory("AutoMonEscrow");
  const escrow = await AutoMonEscrow.deploy();

  await escrow.waitForDeployment();

  const contractAddress = await escrow.getAddress();

  console.log("\n✅ AutoMonEscrow deployed to:", contractAddress);
  console.log("Admin:", deployer.address);
  console.log("Fee:", "5%");
  console.log("\nAdd to .env.local:");
  console.log(`ESCROW_CONTRACT_ADDRESS=${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
