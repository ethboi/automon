// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AutoMonEscrow
 * @dev Escrow contract for AutoMon battle wagers on Monad
 */
contract AutoMonEscrow {
    address public admin;
    uint256 public feePercent = 5; // 5% fee

    struct Battle {
        address player1;
        address player2;
        uint256 wager;
        bool settled;
    }

    mapping(bytes32 => Battle) public battles;

    event BattleCreated(bytes32 indexed battleId, address player1, uint256 wager);
    event BattleJoined(bytes32 indexed battleId, address player2);
    event BattleSettled(bytes32 indexed battleId, address winner, uint256 payout);
    event BattleCancelled(bytes32 indexed battleId, address player1);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /**
     * @dev Create a new battle with a wager
     * @param battleId Unique identifier for the battle
     */
    function createBattle(bytes32 battleId) external payable {
        require(msg.value > 0, "Must wager something");
        require(battles[battleId].player1 == address(0), "Battle exists");

        battles[battleId] = Battle({
            player1: msg.sender,
            player2: address(0),
            wager: msg.value,
            settled: false
        });

        emit BattleCreated(battleId, msg.sender, msg.value);
    }

    /**
     * @dev Join an existing battle by matching the wager
     * @param battleId The battle to join
     */
    function joinBattle(bytes32 battleId) external payable {
        Battle storage battle = battles[battleId];
        require(battle.player1 != address(0), "Battle not found");
        require(battle.player2 == address(0), "Battle full");
        require(msg.value == battle.wager, "Wrong wager amount");
        require(msg.sender != battle.player1, "Cannot join own battle");

        battle.player2 = msg.sender;
        emit BattleJoined(battleId, msg.sender);
    }

    /**
     * @dev Settle the battle and pay the winner (admin only)
     * @param battleId The battle to settle
     * @param winner Address of the winner
     */
    function settleBattle(bytes32 battleId, address winner) external onlyAdmin {
        Battle storage battle = battles[battleId];
        require(!battle.settled, "Already settled");
        require(battle.player2 != address(0), "Battle not started");
        require(
            winner == battle.player1 || winner == battle.player2,
            "Invalid winner"
        );

        battle.settled = true;
        uint256 pot = battle.wager * 2;
        uint256 fee = (pot * feePercent) / 100;
        uint256 payout = pot - fee;

        (bool success, ) = payable(winner).call{value: payout}("");
        require(success, "Transfer failed");

        emit BattleSettled(battleId, winner, payout);
    }

    /**
     * @dev Cancel a battle that hasn't been joined yet
     * @param battleId The battle to cancel
     */
    function cancelBattle(bytes32 battleId) external {
        Battle storage battle = battles[battleId];
        require(msg.sender == battle.player1, "Only creator");
        require(battle.player2 == address(0), "Already joined");
        require(!battle.settled, "Already settled");

        battle.settled = true;

        (bool success, ) = payable(battle.player1).call{value: battle.wager}("");
        require(success, "Transfer failed");

        emit BattleCancelled(battleId, battle.player1);
    }

    /**
     * @dev Withdraw accumulated fees (admin only)
     */
    function withdraw() external onlyAdmin {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");

        (bool success, ) = payable(admin).call{value: balance}("");
        require(success, "Transfer failed");
    }

    /**
     * @dev Transfer admin rights
     * @param newAdmin Address of the new admin
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid address");
        admin = newAdmin;
    }

    /**
     * @dev Update fee percentage (admin only)
     * @param newFeePercent New fee percentage (0-20)
     */
    function setFeePercent(uint256 newFeePercent) external onlyAdmin {
        require(newFeePercent <= 20, "Fee too high");
        feePercent = newFeePercent;
    }

    /**
     * @dev Get battle details
     * @param battleId The battle ID
     */
    function getBattle(bytes32 battleId)
        external
        view
        returns (
            address player1,
            address player2,
            uint256 wager,
            bool settled
        )
    {
        Battle memory battle = battles[battleId];
        return (battle.player1, battle.player2, battle.wager, battle.settled);
    }
}
