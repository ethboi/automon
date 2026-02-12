import { ethers } from 'ethers';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const NAMES = { 1:'Blazeon',2:'Emberwing',3:'Magmor',4:'Cindercat',5:'Aquaris',6:'Tidalon',7:'Coralix',8:'Frostfin',9:'Terrox',10:'Bouldern',11:'Crysthorn',12:'Zephyrix',13:'Stormwing',14:'Gustal',15:'Shadowmere',16:'Voidling',17:'Noxfang',18:'Luxara',19:'Solaris',20:'Aurorix' };
const ELEMENTS = { 1:'fire',2:'fire',3:'fire',4:'fire',5:'water',6:'water',7:'water',8:'water',9:'earth',10:'earth',11:'earth',12:'air',13:'air',14:'air',15:'dark',16:'dark',17:'dark',18:'light',19:'light',20:'light' };
const RARITIES = ['common','uncommon','rare','epic','legendary'];

const network = new ethers.Network('monad', 143);
const provider = new ethers.JsonRpcProvider('https://rpc.monad.xyz', network, { staticNetwork: network });
const nft = new ethers.Contract('0x46A77fF689773B637A4af9D131e7E9f99eDc9B58', [
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function getCard(uint256) view returns (uint8 automonId, uint8 rarity)',
], provider);

const supply = Number(await nft.totalSupply());
console.log('On-chain totalSupply:', supply);

const client = await MongoClient.connect(process.env.MONGODB_URI);
const db = client.db('automon');
await db.collection('cards').deleteMany({});
console.log('Cleared DB cards');

let synced = 0;
for (let i = 1; i <= supply; i++) {
  try {
    const owner = (await nft.ownerOf(i)).toLowerCase();
    const [automonId, rarity] = await nft.getCard(i);
    const aid = Number(automonId);
    const rar = Number(rarity);
    const baseStats = { attack: 40 + rar * 10, defense: 35 + rar * 8, speed: 30 + rar * 6, special: 25 + rar * 12, hp: 100 + rar * 20 };

    await db.collection('cards').insertOne({
      tokenId: i, owner,
      name: NAMES[aid] || `AutoMon #${aid}`,
      element: ELEMENTS[aid] || 'unknown',
      rarity: RARITIES[rar] || 'common',
      automonId: aid,
      stats: baseStats,
      ability: { name: (NAMES[aid] || 'AutoMon') + ' Strike', power: 30 + rar * 15, type: ELEMENTS[aid] || 'normal' },
      mintedAt: new Date(),
    });
    synced++;
  } catch(e) { console.log('Token', i, 'skip:', e.message.slice(0,50)); }
}

console.log(`Synced ${synced}/${supply} cards`);

const byOwner = await db.collection('cards').aggregate([{ $group: { _id: '$owner', count: { $sum: 1 } } }]).toArray();
console.log('DB now:', byOwner);
await client.close();
