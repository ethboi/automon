// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title AutoMonNFT
 * @dev ERC-721 NFT contract for AutoMon cards on Monad
 * Pack purchasing: 0.1 MON = 5 random cards from 20 AutoMon types
 */
contract AutoMonNFT is ERC721, Ownable {
    using Strings for uint256;

    error InsufficientPayment();
    error RefundFailed();
    error TokenDoesNotExist();
    error NoBalanceToWithdraw();
    error WithdrawalFailed();

    uint256 public constant PACK_PRICE = 0.1 ether; // 0.1 MON
    uint256 public constant CARDS_PER_PACK = 5;
    uint256 public constant TOTAL_AUTOMONS = 20;

    // Rarity levels: 0=Common, 1=Uncommon, 2=Rare, 3=Epic, 4=Legendary
    uint8 public constant RARITY_COMMON = 0;
    uint8 public constant RARITY_UNCOMMON = 1;
    uint8 public constant RARITY_RARE = 2;
    uint8 public constant RARITY_EPIC = 3;
    uint8 public constant RARITY_LEGENDARY = 4;

    struct Card {
        uint8 automonId;   // 1-20
        uint8 rarity;      // 0-4 (common to legendary)
    }

    mapping(uint256 => Card) public cards;
    uint256 public totalSupply;
    string public baseURI;

    event PackPurchased(address indexed buyer, uint256[] tokenIds);
    event CardMinted(uint256 indexed tokenId, uint8 automonId, uint8 rarity);

    constructor(string memory _baseURI) ERC721("AutoMon", "AMON") Ownable(msg.sender) {
        baseURI = _baseURI;
    }

    /**
     * @dev Buy a pack of 5 random AutoMon cards
     */
    function buyPack() external payable {
        if (msg.value < PACK_PRICE) {
            revert InsufficientPayment();
        }

        uint256[] memory tokenIds = new uint256[](CARDS_PER_PACK);

        for (uint256 i = 0; i < CARDS_PER_PACK; i++) {
            uint256 tokenId = ++totalSupply;
            uint8 automonId = _randomAutomonId(tokenId, i);
            uint8 rarity = _rollRarity(tokenId, i);

            cards[tokenId] = Card(automonId, rarity);
            _mint(msg.sender, tokenId);

            tokenIds[i] = tokenId;
            emit CardMinted(tokenId, automonId, rarity);
        }

        emit PackPurchased(msg.sender, tokenIds);

        // Refund excess payment
        if (msg.value > PACK_PRICE) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - PACK_PRICE}("");
            if (!success) {
                revert RefundFailed();
            }
        }
    }

    /**
     * @dev Generate a random AutoMon ID (1-20)
     */
    function _randomAutomonId(uint256 tokenId, uint256 cardIndex) internal view returns (uint8) {
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            tokenId,
            cardIndex,
            "automonId"
        )));
        return uint8((random % TOTAL_AUTOMONS) + 1);
    }

    /**
     * @dev Roll rarity based on weighted probabilities
     * Common: 60%, Uncommon: 25%, Rare: 10%, Epic: 4%, Legendary: 1%
     */
    function _rollRarity(uint256 tokenId, uint256 cardIndex) internal view returns (uint8) {
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            tokenId,
            cardIndex,
            "rarity"
        ))) % 100;

        if (random < 60) return RARITY_COMMON;       // 0-59: 60%
        if (random < 85) return RARITY_UNCOMMON;     // 60-84: 25%
        if (random < 95) return RARITY_RARE;         // 85-94: 10%
        if (random < 99) return RARITY_EPIC;         // 95-98: 4%
        return RARITY_LEGENDARY;                      // 99: 1%
    }

    /**
     * @dev Get card details
     */
    function getCard(uint256 tokenId) external view returns (uint8 automonId, uint8 rarity) {
        if (tokenId == 0 || tokenId > totalSupply) {
            revert TokenDoesNotExist();
        }
        Card memory card = cards[tokenId];
        return (card.automonId, card.rarity);
    }

    /**
     * @dev Get all cards owned by an address
     */
    function getCardsOf(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](balance);
        uint256 index = 0;

        for (uint256 i = 1; i <= totalSupply && index < balance; i++) {
            if (_ownerOf(i) == owner) {
                tokenIds[index++] = i;
            }
        }

        return tokenIds;
    }

    /**
     * @dev Returns the token URI for metadata
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (tokenId == 0 || tokenId > totalSupply) {
            revert TokenDoesNotExist();
        }
        return string(abi.encodePacked(baseURI, tokenId.toString()));
    }

    /**
     * @dev Update base URI (owner only)
     */
    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }

    /**
     * @dev Withdraw contract balance (owner only)
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) {
            revert NoBalanceToWithdraw();
        }

        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) {
            revert WithdrawalFailed();
        }
    }

    /**
     * @dev Check if a token exists
     */
    function exists(uint256 tokenId) external view returns (bool) {
        return tokenId > 0 && tokenId <= totalSupply;
    }
}
