// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AutoMonEscrow
 * @dev Escrow contract for AutoMon battle wagers on Monad
 */
contract AutoMonEscrow is ReentrancyGuard {
    error OnlyAdmin();
    error MustWagerSomething();
    error BattleAlreadyExists();
    error BattleNotFound();
    error BattleFull();
    error WrongWagerAmount();
    error CannotJoinOwnBattle();
    error AlreadySettled();
    error BattleNotStarted();
    error InvalidWinner();
    error TransferFailed();
    error OnlyCreator();
    error AlreadyJoined();
    error NoBalance();
    error InvalidAddress();
    error FeeTooHigh();

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
        if (msg.sender != admin) {
            revert OnlyAdmin();
        }
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
        if (msg.value == 0) {
            revert MustWagerSomething();
        }
        if (battles[battleId].player1 != address(0)) {
            revert BattleAlreadyExists();
        }

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
    function joinBattle(bytes32 battleId) external payable nonReentrant {
        Battle storage battle = battles[battleId];
        if (battle.player1 == address(0)) {
            revert BattleNotFound();
        }
        if (battle.player2 != address(0)) {
            revert BattleFull();
        }
        if (msg.value != battle.wager) {
            revert WrongWagerAmount();
        }
        if (msg.sender == battle.player1) {
            revert CannotJoinOwnBattle();
        }

        battle.player2 = msg.sender;
        emit BattleJoined(battleId, msg.sender);
    }

    /**
     * @dev Settle the battle and pay the winner (admin only)
     * @param battleId The battle to settle
     * @param winner Address of the winner
     */
    function settleBattle(bytes32 battleId, address winner) external onlyAdmin nonReentrant {
        Battle storage battle = battles[battleId];
        if (battle.settled) {
            revert AlreadySettled();
        }
        if (battle.player2 == address(0)) {
            revert BattleNotStarted();
        }
        if (winner != battle.player1 && winner != battle.player2) {
            revert InvalidWinner();
        }

        battle.settled = true;
        uint256 pot = battle.wager * 2;
        uint256 fee = (pot * feePercent) / 100;
        uint256 payout = pot - fee;

        (bool success, ) = payable(winner).call{value: payout}("");
        if (!success) {
            revert TransferFailed();
        }

        emit BattleSettled(battleId, winner, payout);
    }

    /**
     * @dev Cancel a battle that hasn't been joined yet
     * @param battleId The battle to cancel
     */
    function cancelBattle(bytes32 battleId) external nonReentrant {
        Battle storage battle = battles[battleId];
        if (msg.sender != battle.player1) {
            revert OnlyCreator();
        }
        if (battle.player2 != address(0)) {
            revert AlreadyJoined();
        }
        if (battle.settled) {
            revert AlreadySettled();
        }

        battle.settled = true;

        (bool success, ) = payable(battle.player1).call{value: battle.wager}("");
        if (!success) {
            revert TransferFailed();
        }

        emit BattleCancelled(battleId, battle.player1);
    }

    /**
     * @dev Withdraw accumulated fees (admin only)
     */
    function withdraw() external onlyAdmin {
        uint256 balance = address(this).balance;
        if (balance == 0) {
            revert NoBalance();
        }

        (bool success, ) = payable(admin).call{value: balance}("");
        if (!success) {
            revert TransferFailed();
        }
    }

    /**
     * @dev Transfer admin rights
     * @param newAdmin Address of the new admin
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) {
            revert InvalidAddress();
        }
        admin = newAdmin;
    }

    /**
     * @dev Update fee percentage (admin only)
     * @param newFeePercent New fee percentage (0-20)
     */
    function setFeePercent(uint256 newFeePercent) external onlyAdmin {
        if (newFeePercent > 20) {
            revert FeeTooHigh();
        }
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
