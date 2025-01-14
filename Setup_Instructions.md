
# Mining Setup Instructions

Follow these steps to successfully build and start your mining process:


---

## **Step 0: Initialize and Clean Configuration Files**

1. **Initialize Configuration Files**  
   This command creates the default configuration files for btcd, btcwallet, and btcctl.
   ```bash
   npm run init:config
   ```

2. **Delete Configuration Files**  
   This command removes all existing configuration files for a fresh setup.
   ```bash
   npm run delete:config
   ```

---

## **Step 1: Build Required Components**

Run the following commands to build the necessary components:

1. **Build BTCD**  
   ```bash
   npm run build:btcd
   ```
2. **Build BTCWallet**  
   ```bash
   npm run build:btcwallet
   ```
3. **Build BTCCTL**  
   ```bash
   npm run build:btcctl
   ```

**or**

To build all the required components (BTCD, BTCWallet, BTCCTL) in one step, run:
```bash
npm run build
```

---

## **Step 2: Create BTCWallet for Testnet**

Create a new BTCWallet configuration for the testnet:

```bash
npm run create:btcwallet:testnet
```

**Note:**  
If you want to reset the wallet, navigate to the directory containing `wallet.db` and delete it. Typically, this file can be found in the wallet's data directory. Deleting `wallet.db` will initialize the wallet anew.

---

## **Step 3: Start the Testnet Nodes**

1. **Start BTCD Testnet**  
   ```bash
   npm run start:btcd:testnet
   ```

2. **Start BTCWallet Testnet**  
   ```bash
   npm run start:btcwallet:testnet
   ```

---

## **Step 4: Generate a New Address**

Generate a new address, retrieve received addresses, and check the status of the blockchain:

```bash
npm run generate:newaddress
```

---

## **Step 5: Select Mining Address**

Before starting mining, you should select the address that will receive the mined rewards. By default, the address with the **highest amount** is selected. To specify a particular address by its index:

1. **Get the Mining Address Index**  
   List all available addresses with their indices, amounts, and confirmations:  
   ```bash
   npm run get:miningAddressIndex
   ```

   Example Output:
   ```
   Index | Address                                 | Amount     | Confirmations
   ----------------------------------------------------------------------
   0     | mkca7Uk2NJkxyJnhk4phEXapGMSH8iqTJq      | 0.00000000 | 0
   1     | mpr3UYsUzCdrVETNZ5wNoeYxAzdDkJjdQt      | 0.00000000 | 0
   2     | mtqWoAAS5YPjpAh7A3tV9Wy6iKzZkkZc4s      | 0.00000000 | 0
   3     | muvKUV9Vujvr5b1Ai38akqtxScM3Czxtv7      | 0.01220703 | 1
   ```

2. **Stop BTCD Before Selecting a Mining Address**  
   Make sure to stop the `btcd` process before selecting a mining address and starting it again with the chosen address:  
   ```bash
   npm run stop:btcd
   ```

3. **Start BTCD with a Mining Address**  
   Use the default (highest amount) address or provide an index as an argument to select a specific address:  
   ```bash
   npm run start:btcdWithMiningaddressIndex:testnet [index]
   ```
   Replace `[index]` with the desired address index (e.g., `3`). If no index is provided, the script will default to the address with the highest amount.

---

## **Step 6: Start Mining**

Start mining blocks:

```bash
npm run start:mining [number_of_blocks]
```

- **Default:** The script will mine `1,000,000` blocks if no argument is provided.
- **Custom Number:** Provide a specific number of blocks to mine (e.g., `100`):  
  ```bash
  npm run start:mining 100
  ```

---

## **Step 7: Start server and client**
Now, start both the server and client to run the complete system.

1. Start Server
Launch the backend server. This runs the Go-based application layer responsible for file sharing and other functionalities.
```bash
npm run start:server
```
  Description:
  This command navigates to the application-layer directory and executes the main.go file. The server handles API requests, wallet management, and other backend operations.

2. Start Client
Launch the frontend client. This runs the React application providing the user interface.
```bash
npm run start:client
```
  Description:
  This command navigates to the client directory and starts the React development server. The client allows users to interact with the application, manage wallets, and perform mining operations.

Important:
Ensure that both the server and client are running simultaneously in separate terminal windows. Verify that each is operating correctly by checking their respective logs for any error messages.
## **Additional Information**

- **Retrieve Information About the Network or Addresses**  
  The following commands can be run independently to retrieve additional information:

  1. **List Received Addresses:**  
     ```bash
     npm run get:receivedaddresses
     ```

  2. **Check Block Generation Status: Indicates `true` if currently mining**  
     ```bash
     npm run get:generate
     ```

  3. **Check Mining Info:**  
     ```bash
     npm run get:mininginfo
     ```
  4. **delete Mining Address(need repair):**   
     ```bash
     npm run delete:addressByIndex [index]
     ```

---

By following these steps, you can build, start, and configure your mining environment while maintaining flexibility in address selection and block generation settings. Ensure that `btcd` is stopped before configuring it with a mining address to avoid conflicts. If needed, reset the wallet by deleting `wallet.db` as instructed in Step 2.
