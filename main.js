const axios = require('axios');
const ethers = require('ethers');

const walletAddress = '0xaFe186232442a29D829bd38c6BEA35FBa6AfBaa0';
const address404 = '0xDc2e74740279dD1ed27727eddf80aF7CcC3D6a72';
const addressLocker = '0x22FC303b11c6638C5967B3861c5a2C35449dF26e';

const abi404 = [
    {
        "constant": true,
        "inputs": [
            {
                "name": "owner",
                "type": "address"
            }
        ],
        "name": "ownedCount",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            {
                "name": "owner",
                "type": "address"
            },
            {
                "name": "index",
                "type": "uint256"
            }
        ],
        "name": "owned",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    }
];

const abiLocker = [
    {
        "constant": true,
        "inputs": [
            {
                "name": "collection",
                "type": "address"
            },
            {
                "name": "nftId",
                "type": "uint256"
            }
        ],
        "name": "lockedInfo",
        "outputs": [
            {
                "name": "",
                "type": "address"
            },
            {
                "name": "",
                "type": "bool"
            },
            {
                "name": "",
                "type": "address"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {
                "name": "owner",
                "type": "address"
            },
            {
                "name": "is404",
                "type": "bool"
            },
            {
                "name": "distributionTarget",
                "type": "address"
            }
        ],
        "name": "Lock",
        "outputs": [],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    }
];


const pulseRpc = 'https://rpc.pulsechain.com';
const sparkApi = `https://api.marketplace.sparkswap.xyz/api/nfts?collectionId=1&account=${walletAddress}&skip=0&limit=100`;

const getNFTfromBack = async (url) => {
    try {
        const response = await axios.get(url);
        const tokenIds = response.data.map(nft => nft.tokenId.toString());
        return tokenIds;
    } catch (error) {
        console.error('Backend error', error);
        return [];
    }
};

const getContractData = async () => {
    const provider = new ethers.JsonRpcProvider(pulseRpc);
    const contract404 = new ethers.Contract(address404, abi404, provider);
    const lockerContract = new ethers.Contract(addressLocker, abiLocker, provider);

    const [nftsCount, lockerNFTsCount] = await Promise.all([
        contract404.ownedCount(walletAddress),
        contract404.ownedCount(addressLocker)
    ]);

    const getNFTIds = async (contract, address, count) => {
        const promises = [];
        for (let i = 0; i < count; i++) {
            promises.push(contract.owned(address, i));
        }
        const nftIds = await Promise.all(promises);
        return nftIds.map(id => id.toString());
    };

    const [NFTids, lockerNFTids] = await Promise.all([
        getNFTIds(contract404, walletAddress, nftsCount),
        getNFTIds(contract404, addressLocker, lockerNFTsCount)
    ]);

    const lockPromises = lockerNFTids.map(id => lockerContract.lockedInfo(address404, id));
    const locks = await Promise.all(lockPromises);

    locks.forEach((lock, index) => {
        if (lock[2] === walletAddress) { 
            NFTids.push(lockerNFTids[index]);
        }
    });
    return NFTids;
};

const main = async () => {
    try {
        const backendNFTs = await getNFTfromBack(sparkApi);
        if (backendNFTs.length > 0) {
            console.log('NFTs from backend:', backendNFTs);
            
            const contractNFTs = await getContractData();
            if (contractNFTs.length > 0) {
                console.log('NFTs from contract:', contractNFTs);

                const contractSet = new Set(contractNFTs);
                const backendSet = new Set(backendNFTs);
                
                const extraInBackend = backendNFTs.filter(id => !contractSet.has(id));
                const missingInBackend = contractNFTs.filter(id => !backendSet.has(id));

                if (extraInBackend.length > 0) {
                    console.log('Extra NFTs in backend:', extraInBackend);
                }
                
                if (missingInBackend.length > 0) {
                    console.log('Missing NFTs in backend:', missingInBackend);
                }

                if (extraInBackend.length === 0 && missingInBackend.length === 0) {
                    console.log('All NFT IDs match between contract and backend');
                } else {
                    console.log('NFT IDs do not match between contract and backend');
                }
            }
        } else {
            console.log(`Wallet ${walletAddress} doesn't have NFTs`);
        }
    } catch (error) {
        console.error('Error:', error);
    }
};


main();
