import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { AUTOMONS, RARITY_MULTIPLIERS } from '@/lib/automons';
import { getNftContractAddress, getRpcUrl } from '@/lib/network';
export const dynamic = 'force-dynamic';

const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const;

const NFT_CONTRACT_ABI = [
  'function getCard(uint256 tokenId) external view returns (uint8 automonId, uint8 rarity)',
  'function exists(uint256 tokenId) external view returns (bool)',
];

export async function GET(
  request: NextRequest,
  { params }: { params: { tokenId: string } }
) {
  try {
    const tokenId = parseInt(params.tokenId);

    if (isNaN(tokenId) || tokenId <= 0) {
      return NextResponse.json({ error: 'Invalid token ID' }, { status: 400 });
    }

    const contractAddress = getNftContractAddress();
    const rpcUrl = getRpcUrl();

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, NFT_CONTRACT_ABI, provider);

    // Check if token exists
    const exists = await contract.exists(tokenId);
    if (!exists) {
      return NextResponse.json({ error: 'Token does not exist' }, { status: 404 });
    }

    // Get card data from contract
    const [automonId, rarityIndex] = await contract.getCard(tokenId);

    const automonIdNum = Number(automonId);
    const rarityNum = Number(rarityIndex);

    const automon = AUTOMONS.find(a => a.id === automonIdNum);
    if (!automon) {
      return NextResponse.json({ error: 'AutoMon type not found' }, { status: 404 });
    }

    const rarityName = RARITY_NAMES[rarityNum] || 'Common';
    const rarityKey = rarityName.toLowerCase() as keyof typeof RARITY_MULTIPLIERS;
    const multiplier = RARITY_MULTIPLIERS[rarityKey] || 1.0;

    // Calculate scaled stats based on rarity
    const scaledAttack = Math.floor(automon.baseAttack * multiplier);
    const scaledDefense = Math.floor(automon.baseDefense * multiplier);
    const scaledSpeed = Math.floor(automon.baseSpeed * multiplier);
    const scaledHp = Math.floor(automon.baseHp * multiplier);

    // Get the base URL for images
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://automon.xyz';
    // Use SVG for now, will be replaced with PNG later
    const imageUrl = `${baseUrl}/images/automons/${automonIdNum}.svg`;

    // Build NFT metadata following OpenSea standard
    const metadata = {
      name: `${automon.name} #${tokenId}`,
      description: `A ${rarityName.toLowerCase()} ${automon.element}-type AutoMon. ${getDescription(automon.name, automon.element)}`,
      image: imageUrl,
      external_url: `${baseUrl}/card/${tokenId}`,
      attributes: [
        { trait_type: 'AutoMon', value: automon.name },
        { trait_type: 'Element', value: capitalize(automon.element) },
        { trait_type: 'Rarity', value: rarityName },
        { trait_type: 'Attack', value: scaledAttack, display_type: 'number' },
        { trait_type: 'Defense', value: scaledDefense, display_type: 'number' },
        { trait_type: 'Speed', value: scaledSpeed, display_type: 'number' },
        { trait_type: 'HP', value: scaledHp, display_type: 'number' },
        { trait_type: 'Ability', value: automon.ability },
        { trait_type: 'AutoMon ID', value: automonIdNum, display_type: 'number' },
      ],
    };

    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Metadata fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 });
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getDescription(name: string, element: string): string {
  const descriptions: Record<string, string> = {
    Blazeon: 'A fierce fire dragon that commands blazing infernos.',
    Emberwing: 'A swift phoenix with wings of glowing embers.',
    Magmor: 'A powerful lava golem from the depths of volcanoes.',
    Cindercat: 'A nimble feline wreathed in dancing flames.',
    Aquaris: 'An ancient sea serpent that commands the tides.',
    Tidalon: 'A mystical dolphin with healing waters.',
    Coralix: 'A sturdy coral guardian of the deep reefs.',
    Frostfin: 'An icy fish from the frozen northern seas.',
    Terrox: 'A massive rock titan that shakes the earth.',
    Bouldern: 'A stalwart stone guardian with unbreakable defense.',
    Crysthorn: 'A crystalline beast with razor-sharp formations.',
    Zephyrix: 'A swift wind spirit that rides the gales.',
    Stormwing: 'A thunderbird that commands the storms.',
    Gustal: 'An agile air elemental born from hurricanes.',
    Shadowmere: 'A mysterious void creature from the dark dimension.',
    Voidling: 'A cursed spirit that feeds on negative energy.',
    Noxfang: 'A deadly shadow predator with venomous fangs.',
    Luxara: 'A radiant light spirit that purifies darkness.',
    Solaris: 'A celestial sun guardian with healing powers.',
    Aurorix: 'A majestic aurora phoenix of pure light.',
  };

  return descriptions[name] || `A powerful ${element}-type creature ready for battle.`;
}
