
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Retrieve the network type from environment variables (default: testnet)
const network = process.env.NETWORK || 'testnet';
const isTestnet = network === 'testnet';

// Port settings
const btcdRpcPort = isTestnet ? '18334' : '8334';
const btcwalletRpcPort = isTestnet ? '18332' : '8332';

// Paths to config files
const btcdDir = path.resolve("application-layer", "btcd");
const btcctlDir = path.resolve("application-layer", "btcd", "cmd", "btcctl");
const walletDir = path.resolve("application-layer", "btcwallet");

const configFiles = {
    btcwallet: {
        path: path.join(walletDir, "btcwallet.conf"),
        content: `
username=user
password=password
${isTestnet ? 'testnet=1' : ''}
rpclisten=127.0.0.1:${btcwalletRpcPort}
btcdusername=user
btcdpassword=password
rpcconnect=127.0.0.1:${btcdRpcPort}
noservertls=1
noclienttls=1
        `
    },
    btcd: {
        path: path.join(btcdDir, "btcd.conf"),
        content: `
rpcuser=user
rpcpass=password
notls=1
debuglevel=info
${isTestnet ? 'testnet=1' : ''}
miningaddr=1ANiT1wNVVPrnHyafGDpvtnYJHVUpZ6n1t
        `
    },
    btcctl: {
        path: path.join(btcctlDir, "btcctl.conf"),
        content: `
rpcuser=user
rpcpass=password
${isTestnet ? 'testnet=1' : ''}
rpcserver=127.0.0.1:${btcdRpcPort}
notls=1
wallet=1
        `
    }
};

// Path to `env` file
// const envDir = path.resolve("application-layer", "env");
// const envConfigFilePath = path.join(envDir, "btcwallet.conf");

/**
 * Create a config file if it doesn't exist
 * @param {string} filePath - Path to the config file
 * @param {string} content - Content to write to the config file
 */
function createConfigFile(filePath, content) {
    if (!fs.existsSync(filePath)) {
        try {
            fs.writeFileSync(filePath, content.trim());
            console.log(`Generated config file at: ${filePath}`);
        } catch (err) {
            console.error(`Failed to create config file at ${filePath}: ${err.message}`);
        }
    } else {
        console.log(`Config file already exists at: ${filePath}, skipping creation.`);
    }
}

/**
 * Delete a config file if it exists
 * @param {string} filePath - Path to the config file
 */
function deleteConfigFile(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log(`Deleted config file at: ${filePath}`);
        } catch (err) {
            console.error(`Failed to delete config file at ${filePath}: ${err.message}`);
        }
    } else {
        console.log(`Config file does not exist at: ${filePath}, nothing to delete.`);
    }
}

/**
 * Initialize all config files
 */
function initializeConfigFiles() {
    for (const key in configFiles) {
        const { path, content } = configFiles[key];
        createConfigFile(path, content);
    }
}

/**
 * Delete all config files
 */
function deleteAllConfigFiles() {
    for (const key in configFiles) {
        const { path } = configFiles[key];
        deleteConfigFile(path);
    }
}



function generateNewAddress() {
    const ctlDir = path.resolve("application-layer", "btcd", "cmd", "btcctl");
    const ctlExe = path.join(ctlDir, os.platform() === "win32" ? "btcctl.exe" : "btcctl");
    const rpcUser = process.env.BTCD_RPCUSER || 'user';
    const rpcPass = process.env.BTCD_RPCPASS || 'password';
    const command = `"${ctlExe}" --wallet --rpcuser=${rpcUser} --rpcpass=${rpcPass} --rpcserver=127.0.0.1:18332 --notls getnewaddress`;

    console.log(`Executing: ${command}`);
    try {
        const address = execSync(command, { encoding: 'utf-8' }).trim();
        console.log(`Generated Address: ${address}`);

        // Refresh received addresses
        console.log("Refreshing received addresses...");
        const receivedAddresses = getReceivedAddresses();

        // Refresh generate status
        console.log("Refreshing generate status...");
        const generateStatus = getGenerateStatus();

        // Refresh mining info
        console.log("Refreshing mining info...");
        const miningInfo = getMiningInfo();

        // Generate address index chart directly
        console.log("Generating address index chart...");
        console.log("Index | Address                                  | Amount      | Confirmations");
        console.log("--------------------------------------------------------------------------------");

        receivedAddresses.forEach((addr, index) => {
            const amount = addr.amount !== undefined ? addr.amount.toFixed(8) : '0.00000000';
            const confirmations = addr.confirmations !== undefined ? addr.confirmations : '0';
            console.log(`${index.toString().padEnd(5)} | ${addr.address.padEnd(40)} | ${amount.padEnd(10)} | ${confirmations}`);
        });

        console.log("Address index chart generated successfully.");
        console.log("Data refresh completed successfully.");
    } catch (err) {
        console.error(`Failed to generate new address: ${err.message}`);
        throw err; // Ensure proper error handling
    }
}



function getReceivedAddresses() {
    const ctlDir = path.resolve("application-layer", "btcd", "cmd", "btcctl");
    const ctlExe = path.join(ctlDir, os.platform() === "win32" ? "btcctl.exe" : "btcctl");
    const rpcUser = process.env.BTCD_RPCUSER || 'user';
    const rpcPass = process.env.BTCD_RPCPASS || 'password';
    const command = `"${ctlExe}" --wallet --rpcuser=${rpcUser} --rpcpass=${rpcPass} --rpcserver=127.0.0.1:18332 --notls listreceivedbyaddress 0 true`;

    console.log(`Executing: ${command}`);

    try {
        const output = execSync(command, { encoding: 'utf-8' }).trim();

        // Attempt to parse JSON
        let jsonData;
        try {
            jsonData = JSON.parse(output);
        } catch (parseError) {
            console.error(`Failed to parse listreceivedbyaddress output as JSON: ${parseError.message}`);
            jsonData = { rawOutput: output };
        }
        // Save the results as a JSON file
        const outputFilePath = path.resolve("application-layer", "btcd", "cmd", "btcctl", "received_addresses.json");
        fs.writeFileSync(outputFilePath, JSON.stringify(jsonData, null, 2));
        console.log(`Received addresses saved to: ${outputFilePath}`);

        return jsonData; // Returns the parsed data
    } catch (err) {
        console.error(`Failed to list received addresses: ${err.message}`);
        throw err;
    }
}

function getGenerateStatus() {
    const ctlDir = path.resolve("application-layer", "btcd", "cmd", "btcctl");
    const ctlExe = path.join(ctlDir, os.platform() === "win32" ? "btcctl.exe" : "btcctl");
    const rpcUser = process.env.BTCD_RPCUSER || 'user';
    const rpcPass = process.env.BTCD_RPCPASS || 'password';
    const command = `"${ctlExe}" --rpcuser=${rpcUser} --rpcpass=${rpcPass} --rpcserver=127.0.0.1:18332 --notls getgenerate`;

    console.log(`Executing: ${command}`);

    try {
        const output = execSync(command, { encoding: 'utf-8' }).trim();

        let jsonData;
        try {
            jsonData = JSON.parse(output);
        } catch (parseError) {
            console.error(`Failed to parse getgenerate output as JSON: ${parseError.message}`);
            jsonData = { rawOutput: output };
        }

        const outputFilePath = path.resolve("application-layer", "btcd", "cmd", "btcctl", "getgenerate_output.json");
        fs.writeFileSync(outputFilePath, JSON.stringify(jsonData, null, 2));
        console.log(`Output saved to: ${outputFilePath}`);

        return jsonData;
    } catch (err) {
        console.error(`Failed to execute btcctl getgenerate: ${err.message}`);
        throw err;
    }
}

function getMiningInfo() {
    const ctlDir = path.resolve("application-layer", "btcd", "cmd", "btcctl");
    const ctlExe = path.join(ctlDir, os.platform() === "win32" ? "btcctl.exe" : "btcctl");
    const rpcUser = process.env.BTCD_RPCUSER || 'user';
    const rpcPass = process.env.BTCD_RPCPASS || 'password';
    const command = `"${ctlExe}" --rpcuser=${rpcUser} --rpcpass=${rpcPass} --rpcserver=127.0.0.1:18332 --notls getmininginfo`;

    console.log(`Executing: ${command}`);

    try {
        const output = execSync(command, { encoding: 'utf-8' }).trim();

        let jsonData;
        try {
            jsonData = JSON.parse(output);
        } catch (parseError) {
            console.error(`Failed to parse getmininginfo output as JSON: ${parseError.message}`);
            jsonData = { rawOutput: output };
        }

        const outputFilePath = path.resolve("application-layer", "btcd", "cmd", "btcctl", "getmininginfo_output.json");
        fs.writeFileSync(outputFilePath, JSON.stringify(jsonData, null, 2));
        console.log(`Output saved to: ${outputFilePath}`);

        return jsonData;
    } catch (err) {
        console.error(`Failed to execute btcctl getmininginfo: ${err.message}`);
        throw err;
    }
}

// Helper function to get mining address
function getMiningAddress(index) {
    const receivedAddressesPath = path.resolve("application-layer", "btcd", "cmd", "btcctl", "received_addresses.json");
    if (!fs.existsSync(receivedAddressesPath)) {
        console.error(`received_addresses.json not found at: ${receivedAddressesPath}`);
        process.exit(1);
    }

    let addresses;
    try {
        const data = fs.readFileSync(receivedAddressesPath, 'utf-8');
        addresses = JSON.parse(data);
    } catch (err) {
        console.error(`Failed to read or parse received_addresses.json: ${err.message}`);
        process.exit(1);
    }

    if (!Array.isArray(addresses) || addresses.length === 0) {
        console.error("No addresses found in received_addresses.json.");
        process.exit(1);
    }

    let selectedAddress;

    if (index !== undefined) {
        if (isNaN(index) || index < 0 || index >= addresses.length) {
            console.error(`Invalid index provided. Must be between 0 and ${addresses.length - 1}.`);
            process.exit(1);
        }
        selectedAddress = addresses[index].address;
    } else {
        // Select the address with the highest amount
        selectedAddress = addresses.reduce((prev, current) => {
            return (prev.amount > current.amount) ? prev : current;
        }).address;
    }

    return selectedAddress;
}

function getMiningAddressIndex() {
    // Step 1: Update received_addresses.json
    console.log("Updating received addresses...");
    try {
        const updatedAddresses = getReceivedAddresses();
        console.log("Updated received addresses successfully.");
    } catch (err) {
        console.error(`Failed to update received addresses: ${err.message}`);
        process.exit(1);
    }

    // Step 2: Read updated data from received_addresses.json
    const receivedAddressesPath = path.resolve("application-layer", "btcd", "cmd", "btcctl", "received_addresses.json");
    if (!fs.existsSync(receivedAddressesPath)) {
        console.error(`received_addresses.json not found at: ${receivedAddressesPath}`);
        process.exit(1);
    }

    let addresses;
    try {
        const data = fs.readFileSync(receivedAddressesPath, 'utf-8');
        addresses = JSON.parse(data);
    } catch (err) {
        console.error(`Failed to read or parse received_addresses.json: ${err.message}`);
        process.exit(1);
    }

    if (!Array.isArray(addresses) || addresses.length === 0) {
        console.error("No addresses found in received_addresses.json.");
        process.exit(1);
    }

    // Step 3: Display the chart
    console.log("Generating address index chart...");
    console.log("Index | Address                                  | Amount      | Confirmations");
    console.log("--------------------------------------------------------------------------------");

    addresses.forEach((addr, index) => {
        const amount = addr.amount !== undefined ? addr.amount.toFixed(8) : '0.00000000';
        const confirmations = addr.confirmations !== undefined ? addr.confirmations : '0';
        console.log(`${index.toString().padEnd(5)} | ${addr.address.padEnd(40)} | ${amount.padEnd(10)} | ${confirmations}`);
    });

    console.log("Address index chart generated successfully.");
}


// Helper function to delete an address by index
function deleteAddressByIndex(index) {
    const receivedAddressesPath = path.resolve("application-layer", "btcd", "cmd", "btcctl", "received_addresses.json");
    if (!fs.existsSync(receivedAddressesPath)) {
        console.error(`received_addresses.json not found at: ${receivedAddressesPath}`);
        process.exit(1);
    }

    let addresses;
    try {
        const data = fs.readFileSync(receivedAddressesPath, 'utf-8');
        addresses = JSON.parse(data);
    } catch (err) {
        console.error(`Failed to read or parse received_addresses.json: ${err.message}`);
        process.exit(1);
    }

    if (!Array.isArray(addresses) || addresses.length === 0) {
        console.error("No addresses found in received_addresses.json.");
        process.exit(1);
    }

    // Validate the provided index
    if (isNaN(index) || index < 0 || index >= addresses.length) {
        console.error(`Invalid index provided. Must be between 0 and ${addresses.length - 1}.`);
        process.exit(1);
    }

    // Delete the address at the specified index
    const deletedAddress = addresses.splice(index, 1)[0];

    // Save the updated list back to the file
    try {
        fs.writeFileSync(receivedAddressesPath, JSON.stringify(addresses, null, 2));
        console.log(`Successfully deleted address at index ${index}:`);
        console.log(deletedAddress);
        console.log(`Updated list saved to ${receivedAddressesPath}`);
    } catch (err) {
        console.error(`Failed to save updated addresses to file: ${err.message}`);
        process.exit(1);
    }

    // Refresh data using helper functions
    console.log("Refreshing data...");

    try {
        // Refresh received addresses
        console.log("Refreshing received addresses...");
        const refreshedAddresses = getReceivedAddresses();
        console.log("Updated received addresses:");
        console.log(refreshedAddresses);

        // Refresh generate status
        console.log("Refreshing generate status...");
        const generateStatus = getGenerateStatus();
        console.log("Updated generate status:");
        console.log(generateStatus);

        // Refresh mining info
        console.log("Refreshing mining info...");
        const miningInfo = getMiningInfo();
        console.log("Updated mining info:");
        console.log(miningInfo);

        // Refresh mining address index
        console.log("Refreshing mining address index...");
        getMiningAddressIndex();

        console.log("Data refreshed successfully.");
    } catch (err) {
        console.error(`Error during data refresh: ${err.message}`);
        process.exit(1);
    }
}

// Define various scripts for building and managing btcd, btcwallet, and btcctl
const scripts = {
    buildBtcd: {
        windows: () => {
            const btcdDir = path.resolve("btcd");
            console.log(`Changing directory to: ${btcdDir}`);
            try {
                process.chdir(btcdDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            const command = "go build -o btcd.exe";
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCD built successfully.");
            } catch (err) {
                console.error(`Failed to build btcd.exe: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            const btcdDir = path.resolve("btcd");
            console.log(`Changing directory to: ${btcdDir}`);
            try {
                process.chdir(btcdDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            const command = "go build -o btcd";
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCD built successfully.");
            } catch (err) {
                console.error(`Failed to build btcd: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            const btcdDir = path.resolve("btcd");
            console.log(`Changing directory to: ${btcdDir}`);
            try {
                process.chdir(btcdDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            const command = "go build -o btcd";
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCD built successfully.");
            } catch (err) {
                console.error(`Failed to build btcd: ${err.message}`);
                process.exit(1);
            }
        }
    },
    startBtcd: {
        windows: () => {
            const btcdDataPath = path.join(
                process.env.USERPROFILE,
                "AppData",
                "Local",
                "Btcd",
                "data",
                "mainnet",
                "blocks_ffldb"
            );
            console.log(`Deleting corrupted data at: ${btcdDataPath}`);
            try {
                fs.rmSync(btcdDataPath, { recursive: true, force: true });
                console.log("Successfully deleted corrupted data.");
            } catch (err) {
                console.error(`Failed to delete corrupted data: ${err.message}`);
                process.exit(1);
            }

            const btcdDir = path.resolve("application-layer", "btcd");
            const btcdExe = path.join(btcdDir, "btcd.exe");
            const configFile = path.join(btcdDir, "btcd.conf");

            console.log(`Changing directory to: ${btcdDir}`);
            try {
                process.chdir(btcdDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            console.log(`Executing: ${btcdExe} --configfile=${configFile}`);
            try {
                execSync(`"${btcdExe}" --configfile="${configFile}"`, { stdio: "inherit" });
                console.log("BTCD started successfully.");
            } catch (err) {
                console.error(`Failed to execute btcd.exe: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            const btcdDataPath = path.join(
                os.homedir(),
                "Library",
                "Application Support",
                "Btcd",
                "data",
                "mainnet",
                "blocks_ffldb"
            );
            console.log(`Deleting corrupted data at: ${btcdDataPath}`);
            try {
                execSync(`rm -rf "${btcdDataPath}"`, { stdio: "inherit" });
                console.log("Successfully deleted corrupted data.");
            } catch (err) {
                console.error(`Failed to delete corrupted data: ${err.message}`);
                process.exit(1);
            }

            const btcdDir = path.resolve("application-layer", "btcd");
            const btcdExe = path.join(btcdDir, "btcd");
            const configFile = path.join(btcdDir, "btcd.conf");

            console.log(`Changing directory to: ${btcdDir}`);
            try {
                process.chdir(btcdDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            console.log(`Executing: ${btcdExe} --configfile=${configFile}`);
            try {
                execSync(`"${btcdExe}" --configfile="${configFile}"`, { stdio: "inherit" });
                console.log("BTCD started successfully.");
            } catch (err) {
                console.error(`Failed to execute btcd: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            const btcdDataPath = path.join(
                os.homedir(),
                ".btcd",
                "data",
                "mainnet",
                "blocks_ffldb"
            );
            console.log(`Deleting corrupted data at: ${btcdDataPath}`);
            try {
                execSync(`rm -rf "${btcdDataPath}"`, { stdio: "inherit" });
                console.log("Successfully deleted corrupted data.");
            } catch (err) {
                console.error(`Failed to delete corrupted data: ${err.message}`);
                process.exit(1);
            }

            const btcdDir = path.resolve("application-layer", "btcd");
            const btcdExe = path.join(btcdDir, "btcd");
            const configFile = path.join(btcdDir, "btcd.conf");

            console.log(`Changing directory to: ${btcdDir}`);
            try {
                process.chdir(btcdDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            console.log(`Executing: ${btcdExe} --configfile=${configFile}`);
            try {
                execSync(`"${btcdExe}" --configfile="${configFile}"`, { stdio: "inherit" });
                console.log("BTCD started successfully.");
            } catch (err) {
                console.error(`Failed to execute btcd: ${err.message}`);
                process.exit(1);
            }
        }
    },
    startElectron: {
        windows: () => {
            const clientDir = path.resolve("client");
            console.log(`Changing directory to: ${clientDir}`);
            try {
                process.chdir(clientDir);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            console.log(`Executing: npx cross-env DISABLE_ESLINT_PLUGIN=true react-app-rewired build && electron ./main.js`);
            try {
                execSync(`npx cross-env DISABLE_ESLINT_PLUGIN=true react-app-rewired build && electron ./main.js`, { stdio: "inherit" });
                console.log("Electron started successfully.");
            } catch (err) {
                console.error(`Failed to start Electron: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            const clientDir = path.resolve("client");
            console.log(`Changing directory to: ${clientDir}`);
            try {
                process.chdir(clientDir);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            console.log(`Executing: DISABLE_ESLINT_PLUGIN=true react-app-rewired build && electron ./main.js`);
            try {
                execSync(`DISABLE_ESLINT_PLUGIN=true react-app-rewired build && electron ./main.js`, { stdio: "inherit" });
                console.log("Electron started successfully.");
            } catch (err) {
                console.error(`Failed to start Electron: ${err.message}`);
                process.exit(1);
            }
        }
    },

    buildBtcwallet: {
        windows: () => {
            const walletDir = path.resolve("btcwallet");
            console.log(`Changing directory to: ${walletDir}`);
            try {
                process.chdir(walletDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            const command = "go build -o btcwallet.exe";
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCWallet built successfully.");
            } catch (err) {
                console.error(`Failed to build btcwallet.exe: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            const walletDir = path.resolve("btcwallet");
            console.log(`Changing directory to: ${walletDir}`);
            try {
                process.chdir(walletDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            const command = "go build -o btcwallet";
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCWallet built successfully.");
            } catch (err) {
                console.error(`Failed to build btcwallet: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            const walletDir = path.resolve("btcwallet");
            console.log(`Changing directory to: ${walletDir}`);
            try {
                process.chdir(walletDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            const command = "go build -o btcwallet";
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCWallet built successfully.");
            } catch (err) {
                console.error(`Failed to build btcwallet: ${err.message}`);
                process.exit(1);
            }
        }
    },
    startServer: {
        macos: () => {
            const serverDir = path.resolve("application-layer");
            console.log(`Changing directory to: ${serverDir}`);
            try {
                process.chdir(serverDir);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            console.log(`Executing: nohup go run main.go &`);
            try {
                execSync(`nohup go run main.go &`, { stdio: "ignore", detached: true });
                console.log("Server started successfully in detached mode.");
            } catch (err) {
                console.error(`Failed to start server: ${err.message}`);
                process.exit(1);
            }
        },
        windows: () => {
            const serverDir = path.resolve("application-layer");
            console.log(`Changing directory to: ${serverDir}`);
            try {
                process.chdir(serverDir);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            console.log(`Executing: start /B go run main.go`);
            try {
                execSync(`start /B go run main.go`, { stdio: "ignore", detached: true });
                console.log("Server started successfully in detached mode.");
            } catch (err) {
                console.error(`Failed to start server: ${err.message}`);
                process.exit(1);
            }
        }
    },
    startBtcwallet: {
        windows: () => {
            const walletDir = path.resolve("application-layer", "btcwallet");
            const walletExe = path.join(walletDir, "btcwallet.exe");
            const configFile = path.join(walletDir, "btcwallet.conf");

            console.log(`Changing directory to: ${walletDir}`);
            try {
                process.chdir(walletDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            console.log(`Executing: ${walletExe} --configfile=${configFile}`);
            try {
                execSync(`"${walletExe}" --configfile="${configFile}"`, { stdio: "inherit" });
                console.log("BTCWallet started successfully.");
            } catch (err) {
                console.error(`Failed to execute btcwallet.exe: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            const walletDir = path.resolve("application-layer", "btcwallet");
            const walletExe = path.join(walletDir, "btcwallet");
            const configFile = path.join(walletDir, "btcwallet.conf");

            console.log(`Changing directory to: ${walletDir}`);
            try {
                process.chdir(walletDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            console.log(`Executing: ${walletExe} --configfile=${configFile}`);
            try {
                execSync(`"${walletExe}" --configfile="${configFile}"`, { stdio: "inherit" });
                console.log("BTCWallet started successfully.");
            } catch (err) {
                console.error(`Failed to execute btcwallet: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            const walletDir = path.resolve("application-layer", "btcwallet");
            const walletExe = path.join(walletDir, "btcwallet");
            const configFile = path.join(walletDir, "btcwallet.conf");

            console.log(`Changing directory to: ${walletDir}`);
            try {
                process.chdir(walletDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            console.log(`Executing: ${walletExe} --configfile=${configFile}`);
            try {
                execSync(`"${walletExe}" --configfile="${configFile}"`, { stdio: "inherit" });
                console.log("BTCWallet started successfully.");
            } catch (err) {
                console.error(`Failed to execute btcwallet: ${err.message}`);
                process.exit(1);
            }
        }
    },
    buildBtcctl: {
        windows: () => {
            const ctlDir = path.resolve("btcd", "cmd", "btcctl");
            console.log(`Changing directory to: ${ctlDir}`);
            try {
                process.chdir(ctlDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            const command = "go build -o btcctl.exe";
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCCTL built successfully.");
            } catch (err) {
                console.error(`Failed to build btcctl.exe: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            const ctlDir = path.resolve("btcd", "cmd", "btcctl");
            console.log(`Changing directory to: ${ctlDir}`);
            try {
                process.chdir(ctlDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            const command = "go build -o btcctl";
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCCTL built successfully.");
            } catch (err) {
                console.error(`Failed to build btcctl: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            const ctlDir = path.resolve("btcd", "cmd", "btcctl");
            console.log(`Changing directory to: ${ctlDir}`);
            try {
                process.chdir(ctlDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            const command = "go build -o btcctl";
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCCTL built successfully.");
            } catch (err) {
                console.error(`Failed to build btcctl: ${err.message}`);
                process.exit(1);
            }
        }
    },
    testWallet: {
        windows: () => {
            console.log("Running wallet tests on Windows...");
            const walletDir = path.resolve("application-layer");
            console.log(`Changing directory to: ${walletDir}`);
            try {
                process.chdir(walletDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            const command = "go test  -v -count=1";
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("Wallet tests ran successfully.");
            } catch (err) {
                console.error(`Failed to run wallet tests: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            console.log("Running wallet tests on macOS...");
            const walletDir = path.resolve("application-layer");
            console.log(`Changing directory to: ${walletDir}`);
            try {
                process.chdir(walletDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            const command = "go test  -v -count=1";
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("Wallet tests ran successfully.");
            } catch (err) {
                console.error(`Failed to run wallet tests: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            console.log("Running wallet tests on Linux...");
            const walletDir = path.resolve("application-layer");
            console.log(`Changing directory to: ${walletDir}`);
            try {
                process.chdir(walletDir);
                console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
                console.error(`Failed to change directory: ${err.message}`);
                process.exit(1);
            }

            const command = "go test  -v -count=1";
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("Wallet tests ran successfully.");
            } catch (err) {
                console.error(`Failed to run wallet tests: ${err.message}`);
                process.exit(1);
            }
        }
    },

    startBtcdTestnet: {
        windows: () => {
            const btcdDir = path.resolve("application-layer", "btcd");
            const btcdExe = path.join(btcdDir, "btcd.exe");
            const command = `"${btcdExe}" --testnet --rpcuser=user --rpcpass=password --notls --rpclisten=127.0.0.1:18334`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCD started in testnet mode successfully.");
            } catch (err) {
                console.error(`Failed to start btcd.exe: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            const btcdDir = path.resolve("application-layer", "btcd");
            const btcdExe = path.join(btcdDir, "btcd");
            const command = `"${btcdExe}" --testnet --rpcuser=user --rpcpass=password --notls`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCD started in testnet mode successfully.");
            } catch (err) {
                console.error(`Failed to start btcd: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            const btcdDir = path.resolve("application-layer", "btcd");
            const btcdExe = path.join(btcdDir, "btcd");
            const command = `"${btcdExe}" --testnet --rpcuser=user --rpcpass=password --notls`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCD started in testnet mode successfully.");
            } catch (err) {
                console.error(`Failed to start btcd: ${err.message}`);
                process.exit(1);
            }
        }
    },

    createBtcwalletTestnet: {
        windows: () => {
            const walletDir = path.resolve("application-layer", "btcwallet");
            const walletExe = path.join(walletDir, "btcwallet.exe");
            const configFile = path.join(walletDir, "btcwallet.conf");
            const command = `"${walletExe}" --testnet --configfile="${configFile}" --noservertls --create`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCWallet created successfully.");
            } catch (err) {
                console.error(`Failed to create btcwallet.exe: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            const walletDir = path.resolve("application-layer", "btcwallet");
            const walletExe = path.join(walletDir, "btcwallet");
            const configFile = path.join(walletDir, "btcwallet.conf");
            const command = `"${walletExe}" --testnet --configfile="${configFile}" --noservertls --create`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCWallet created successfully.");
            } catch (err) {
                console.error(`Failed to create btcwallet: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            const walletDir = path.resolve("application-layer", "btcwallet");
            const walletExe = path.join(walletDir, "btcwallet");
            const configFile = path.join(walletDir, "btcwallet.conf");
            const command = `"${walletExe}" --testnet --configfile="${configFile}" --noservertls --create`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCWallet created successfully.");
            } catch (err) {
                console.error(`Failed to create btcwallet: ${err.message}`);
                process.exit(1);
            }
        }
    },

    startBtcwalletTestnet: {
        windows: () => {
            const walletExe = path.join(walletDir, "btcwallet.exe");
            const configFilePath = configFiles.btcwallet.path;
            const command = `"${walletExe}" --testnet --configfile="${configFilePath}" --noservertls --rpclisten=127.0.0.1:${btcwalletRpcPort}`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCWallet started successfully in testnet mode with specified RPC port.");
            } catch (err) {
                console.error(`Failed to start btcwallet.exe: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            const walletExe = path.join(walletDir, "btcwallet");
            const configFilePath = configFiles.btcwallet.path;
            const command = `"${walletExe}" --testnet --configfile="${configFilePath}" --noservertls --rpclisten=127.0.0.1:${btcwalletRpcPort}`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCWallet started successfully in testnet mode with specified RPC port.");
            } catch (err) {
                console.error(`Failed to start btcwallet: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            const walletExe = path.join(walletDir, "btcwallet");
            const configFilePath = configFiles.btcwallet.path;
            const command = `"${walletExe}" --testnet --configfile="${configFilePath}" --noservertls --rpclisten=127.0.0.1:${btcwalletRpcPort}`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCWallet started successfully in testnet mode with specified RPC port.");
            } catch (err) {
                console.error(`Failed to start btcwallet: ${err.message}`);
                process.exit(1);
            }
        }
    },

    generateNewAddress: {
        windows: () => {
            try {
                generateNewAddress();
            } catch (err) {
                console.error(`Error during address generation and data refresh: ${err.message}`);
            }

        },
        macos: () => {
            try {
                generateNewAddress();
            } catch (err) {
                console.error(`Error during address generation and data refresh: ${err.message}`);
            }

        },
        linux: () => {
            try {
                generateNewAddress();
            } catch (err) {
                console.error(`Error during address generation and data refresh: ${err.message}`);
            }

        }
    },
    startBtcdWithMiningaddrTestnet: {
        windows: (index) => {
            const btcdDir = path.resolve("application-layer", "btcd");
            const btcdExe = path.join(btcdDir, "btcd.exe");
            const configFile = path.join(btcdDir, "btcd.conf");

            const miningAddress = getMiningAddress(index);

            const command = `"${btcdExe}" --testnet --rpcuser=user --rpcpass=password --miningaddr=${miningAddress} --notls --configfile="${configFile}"`;
            console.log(`Executing: ${command}`);
            console.log(`[miningaddr] = ${miningAddress}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCD started in testnet mode successfully with the specified mining address.");
            } catch (err) {
                console.error(`Failed to start btcd.exe: ${err.message}`);
                process.exit(1);
            }
        },
        macos: (index) => {
            const btcdDir = path.resolve("application-layer", "btcd");
            const btcdExe = path.join(btcdDir, "btcd");
            const configFile = path.join(btcdDir, "btcd.conf");

            const miningAddress = getMiningAddress(index);

            const command = `"${btcdExe}" --testnet --rpcuser=user --rpcpass=password --miningaddr=${miningAddress} --notls --configfile="${configFile}"`;
            console.log(`Executing: ${command}`);
            console.log(`[miningaddr] = ${miningAddress}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCD started in testnet mode successfully with the specified mining address.");
            } catch (err) {
                console.error(`Failed to start btcd: ${err.message}`);
                process.exit(1);
            }
        },
        linux: (index) => {
            const btcdDir = path.resolve("application-layer", "btcd");
            const btcdExe = path.join(btcdDir, "btcd");
            const configFile = path.join(btcdDir, "btcd.conf");

            const miningAddress = getMiningAddress(index);

            const command = `"${btcdExe}" --testnet --rpcuser=user --rpcpass=password --miningaddr=${miningAddress} --notls --configfile="${configFile}"`;
            console.log(`Executing: ${command}`);
            console.log(`[miningaddr] = ${miningAddress}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCD started in testnet mode successfully with the specified mining address.");
            } catch (err) {
                console.error(`Failed to start btcd: ${err.message}`);
                process.exit(1);
            }
        }
    },

    startMining: {
        windows: (blocksToGenerate) => {
            const ctlDir = path.resolve("application-layer", "btcd", "cmd", "btcctl");
            const ctlExe = path.join(ctlDir, "btcctl.exe");
            const rpcUser = process.env.BTCD_RPCUSER || 'user';
            const rpcPass = process.env.BTCD_RPCPASS || 'password';
            const blocks = blocksToGenerate ? parseInt(blocksToGenerate, 10) : 1000000; // Default: 1,000,000

            // Block generation limit (e.g., maximum 1,000,000)
            const maxBlocks = 1000000;
            if (blocks > maxBlocks) {
                console.error(`Cannot generate more than ${maxBlocks} blocks.`);
                process.exit(1);
            }

            const command = `"${ctlExe}" --rpcuser=${rpcUser} --rpcpass=${rpcPass} --rpcserver=127.0.0.1:18332 --notls generate ${blocks}`;
            console.log(`Executing: ${command}`);
            try {
                const output = execSync(command, { encoding: "utf-8" });
                console.log(`Successfully generated ${blocks} blocks.`);
                // Save log to a file
                const logPath = path.resolve("application-layer", "btcd", "cmd", "btcctl", "generate_log.txt");
                fs.appendFileSync(logPath, `${new Date().toISOString()} - ${output.trim()}\n`);
                console.log(`Block generation log saved to: ${logPath}`);
            } catch (err) {
                console.error(`Failed to execute btcctl generate: ${err.message}`);
                process.exit(1);
            }
        },
        macos: (blocksToGenerate) => {
            const ctlDir = path.resolve("application-layer", "btcd", "cmd", "btcctl");
            const ctlExe = path.join(ctlDir, "btcctl");
            const rpcUser = process.env.BTCD_RPCUSER || 'user';
            const rpcPass = process.env.BTCD_RPCPASS || 'password';
            const blocks = blocksToGenerate ? parseInt(blocksToGenerate, 10) : 1000000; // Default: 1,000,000

            // Block generation limit (e.g., maximum 1,000,000)
            const maxBlocks = 1000000;
            if (blocks > maxBlocks) {
                console.error(`Cannot generate more than ${maxBlocks} blocks.`);
                process.exit(1);
            }

            const command = `"${ctlExe}" --rpcuser=${rpcUser} --rpcpass=${rpcPass} --rpcserver=127.0.0.1:18332 --notls generate ${blocks}`;
            console.log(`Executing: ${command}`);
            try {
                const output = execSync(command, { encoding: "utf-8" });
                console.log(`Successfully generated ${blocks} blocks.`);
                // Save log to a file
                const logPath = path.resolve("application-layer", "btcd", "cmd", "btcctl", "generate_log.txt");
                fs.appendFileSync(logPath, `${new Date().toISOString()} - ${output.trim()}\n`);
                console.log(`Block generation log saved to: ${logPath}`);
            } catch (err) {
                console.error(`Failed to execute btcctl generate: ${err.message}`);
                process.exit(1);
            }
        },
        linux: (blocksToGenerate) => {
            const ctlDir = path.resolve("application-layer", "btcd", "cmd", "btcctl");
            const ctlExe = path.join(ctlDir, "btcctl");
            const rpcUser = process.env.BTCD_RPCUSER || 'user';
            const rpcPass = process.env.BTCD_RPCPASS || 'password';
            const blocks = blocksToGenerate ? parseInt(blocksToGenerate, 10) : 1000000; // Default: 1,000,000

            // Block generation limit (e.g., maximum 1,000,000)
            const maxBlocks = 1000000;
            if (blocks > maxBlocks) {
                console.error(`Cannot generate more than ${maxBlocks} blocks.`);
                process.exit(1);
            }

            const command = `"${ctlExe}" --rpcuser=${rpcUser} --rpcpass=${rpcPass} --rpcserver=127.0.0.1:18332 --notls generate ${blocks}`;
            console.log(`Executing: ${command}`);
            try {
                const output = execSync(command, { encoding: "utf-8" });
                console.log(`Successfully generated ${blocks} blocks.`);
                // Save log to a file
                const logPath = path.resolve("application-layer", "btcd", "cmd", "btcctl", "generate_log.txt");
                fs.appendFileSync(logPath, `${new Date().toISOString()} - ${output.trim()}\n`);
                console.log(`Block generation log saved to: ${logPath}`);
            } catch (err) {
                console.error(`Failed to execute btcctl generate: ${err.message}`);
                process.exit(1);
            }
        }
    },

    getReceivedByAddress: {
        windows: () => {
            try {
                const addresses = getReceivedAddresses();
                console.log("Successfully retrieved received addresses:");
                console.log(addresses);
            } catch (err) {
                console.error(`Error retrieving addresses: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            try {
                const addresses = getReceivedAddresses();
                console.log("Successfully retrieved received addresses:");
                console.log(addresses);
            } catch (err) {
                console.error(`Error retrieving addresses: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            try {
                const addresses = getReceivedAddresses();
                console.log("Successfully retrieved received addresses:");
                console.log(addresses);
            } catch (err) {
                console.error(`Error retrieving addresses: ${err.message}`);
                process.exit(1);
            }
        }
    },

    getGenerate: {
        windows: () => {
            try {
                const generateStatus = getGenerateStatus();
                console.log("Successfully retrieved generate status:");
                console.log(generateStatus);
            } catch (err) {
                console.error(`Error retrieving generate status: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            try {
                const generateStatus = getGenerateStatus();
                console.log("Successfully retrieved generate status:");
                console.log(generateStatus);
            } catch (err) {
                console.error(`Error retrieving generate status: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            try {
                const generateStatus = getGenerateStatus();
                console.log("Successfully retrieved generate status:");
                console.log(generateStatus);
            } catch (err) {
                console.error(`Error retrieving generate status: ${err.message}`);
                process.exit(1);
            }
        }
    },

    getMiningInfo: {
        windows: () => {
            try {
                const miningInfo = getMiningInfo();
                console.log("Successfully retrieved mining info:");
                console.log(miningInfo);
            } catch (err) {
                console.error(`Error retrieving mining info: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            try {
                const miningInfo = getMiningInfo();
                console.log("Successfully retrieved mining info:");
                console.log(miningInfo);
            } catch (err) {
                console.error(`Error retrieving mining info: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            try {
                const miningInfo = getMiningInfo();
                console.log("Successfully retrieved mining info:");
                console.log(miningInfo);
            } catch (err) {
                console.error(`Error retrieving mining info: ${err.message}`);
                process.exit(1);
            }
        }
    },

    getMiningAddressIndex: {
        windows: () => {
            console.log("Refreshing address index on Windows...");
            getMiningAddressIndex();
        },
        macos: () => {
            console.log("Refreshing address index on macOS...");
            getMiningAddressIndex();
        },
        linux: () => {
            console.log("Refreshing address index on Linux...");
            getMiningAddressIndex();
        }
    },
    
    deleteAddressByIndex: {
        windows: (index) => {
            deleteAddressByIndex(parseInt(index, 10));
        },
        macos: (index) => {
            deleteAddressByIndex(parseInt(index, 10));
        },
        linux: (index) => {
            deleteAddressByIndex(parseInt(index, 10));
        }
    },
    startBtcdMainnet: {
        windows: () => {
            const btcdDir = path.resolve("application-layer", "btcd");
            const btcdExe = path.join(btcdDir, "btcd.exe");
            const configFile = path.join(btcdDir, "btcd.conf");
            const command = `"${btcdExe}" --rpcuser=user --rpcpass=password --notls --configfile="${configFile}"`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCD started successfully on Mainnet.");
            } catch (err) {
                console.error(`Failed to start btcd.exe on Mainnet: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            const btcdDir = path.resolve("application-layer", "btcd");
            const btcdExe = path.join(btcdDir, "btcd");
            const configFile = path.join(btcdDir, "btcd.conf");
            const command = `"${btcdExe}" --rpcuser=user --rpcpass=password --notls --configfile="${configFile}"`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCD started successfully on Mainnet.");
            } catch (err) {
                console.error(`Failed to start btcd on Mainnet: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            const btcdDir = path.resolve("application-layer", "btcd");
            const btcdExe = path.join(btcdDir, "btcd");
            const configFile = path.join(btcdDir, "btcd.conf");
            const command = `"${btcdExe}" --rpcuser=user --rpcpass=password --notls --configfile="${configFile}"`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCD started successfully on Mainnet.");
            } catch (err) {
                console.error(`Failed to start btcd on Mainnet: ${err.message}`);
                process.exit(1);
            }
        }
    },
    startBtcwalletMainnet: {
        windows: () => {
            const walletExe = path.join(walletDir, "btcwallet.exe");
            const command = `"${walletExe}" --configfile="${configFilePath}" --noservertls --rpclisten=127.0.0.1:${btcwalletRpcPort}`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCWallet started successfully on Mainnet.");
            } catch (err) {
                console.error(`Failed to start btcwallet.exe on Mainnet: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            const walletExe = path.join(walletDir, "btcwallet");
            const command = `"${walletExe}" --configfile="${configFilePath}" --noservertls --rpclisten=127.0.0.1:${btcwalletRpcPort}`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCWallet started successfully on Mainnet.");
            } catch (err) {
                console.error(`Failed to start btcwallet on Mainnet: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            const walletExe = path.join(walletDir, "btcwallet");
            const command = `"${walletExe}" --configfile="${configFilePath}" --noservertls --rpclisten=127.0.0.1:${btcwalletRpcPort}`;
            console.log(`Executing: ${command}`);
            try {
                execSync(command, { stdio: "inherit" });
                console.log("BTCWallet started successfully on Mainnet.");
            } catch (err) {
                console.error(`Failed to start btcwallet on Mainnet: ${err.message}`);
                process.exit(1);
            }
        }
    },
    initConfig: {
        windows: () => {
            console.log("Initializing all config files...");
            initializeConfigFiles();
        },
        macos: () => {
            console.log("Initializing all config files...");
            initializeConfigFiles();
        },
        linux: () => {
            console.log("Initializing all config files...");
            initializeConfigFiles();
        }
    },
    deleteConfig: {
        windows: () => {
            console.log("Deleting all config files...");
            deleteAllConfigFiles();
        },
        macos: () => {
            console.log("Deleting all config files...");
            deleteAllConfigFiles();
        },
        linux: () => {
            console.log("Deleting all config files...");
            deleteAllConfigFiles();
        }
    },
    stopBtcd: {
        windows: () => {
            console.log("Stopping btcd process on Windows...");
            try {
                execSync('taskkill /F /IM btcd.exe', { stdio: 'inherit' });
                console.log("Successfully stopped btcd process.");
            } catch (err) {
                console.error(`Failed to stop btcd process: ${err.message}`);
                process.exit(1);
            }
        },
        macos: () => {
            console.log("Stopping btcd process on macOS...");
            try {
                execSync('pkill -f btcd', { stdio: 'inherit' });
                console.log("Successfully stopped btcd process.");
            } catch (err) {
                console.error(`Failed to stop btcd process: ${err.message}`);
                process.exit(1);
            }
        },
        linux: () => {
            console.log("Stopping btcd process on Linux...");
            try {
                execSync('pkill -f btcd', { stdio: 'inherit' });
                console.log("Successfully stopped btcd process.");
            } catch (err) {
                console.error(`Failed to stop btcd process: ${err.message}`);
                process.exit(1);
            }
        }
    }
};

// Retrieve the script name from command-line arguments
const scriptName = process.argv[2];
if (!scriptName || !scripts[scriptName]) {
    console.error("Invalid script name! Available scripts:", Object.keys(scripts).join(", "));
    process.exit(1);
}

const scriptArgs = process.argv.slice(3);
const platform = os.platform();
let osType = "";

if (platform === "win32") osType = "windows";
else if (platform === "darwin") osType = "macos";
else if (platform === "linux") osType = "linux";
else {
    console.error(`Unsupported platform: ${platform}`);
    process.exit(1);
}

// Retrieve the appropriate script function based on the OS type
const scriptFunction = scripts[scriptName][osType];
if (!scriptFunction) {
    console.error(`No script found for '${scriptName}' on '${osType}'`);
    process.exit(1);
}

try {
    console.log(`Running script '${scriptName}' on '${osType}' with arguments: ${scriptArgs.join(" ")}`);
    scriptFunction(...scriptArgs);
} catch (err) {
    console.error(`Error executing script '${scriptName}': ${err.message}`);
    process.exit(1);
}
