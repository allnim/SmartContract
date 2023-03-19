// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '@openzeppelin/contracts/proxy/Clones.sol';
import "../OtoCoPluginV2.sol";

interface ISeriesToken {
    function initialize (string memory name, string memory symbol) external;
    function mint(address to, uint256 amount) external;
    function transferOwnership(address newOwner) external;
    function name() external returns (string memory);
}

interface IOtoCoGovernor {
    function initialize (
        address _token, 
        address _firstManager, 
        address[] calldata _allowed, 
        uint256 _votingPeriod, 
        string calldata _contractName
    ) external;
}

/**
 * Tokenized LLCs factory plugin
 */
contract TokenizationV2 is OtoCoPluginV2 {

    // Custom Errors
    error EntityAlreadyExists();
    error EntityInexistent();

    event Tokenized(uint256 indexed series, address dao);
    event Untokenized(uint256 indexed series);

    // DAO source contract to be cloned
    address public governorContract;
    // Mapping from entities to deployed tokens
    mapping(uint256 => address) public governorsDeployed;


    /**
    * Constructor for Token Plugin.
    *
    * @param otocoMaster Address from the Master contract.
    * @param governor Address from the governor source contract to be cloned.
     */
    constructor(
        address payable otocoMaster,
        address governor
    ) OtoCoPluginV2(otocoMaster) {
        governorContract = governor;
    }
	/**
    * Update dao contract base source.
    *
    * @param newAddress New token source to be used
     */
    function updateGovernorContract(address newAddress) public onlyOwner {
        governorContract = newAddress;
    }


    /**
    * Create a new Tokenization contract for the entity. May only be called by the owner of the series.
    *
    * @dev seriesId would be the series that will own the token.
    * @param pluginData Encoded parameters to create a new token.
     */
    function addPlugin(uint256 seriesId, bytes calldata pluginData) 
    public onlySeriesOwner(seriesId) transferFees() payable override 
    {
        (
            // Token and Governor name
            string memory name,
            // Token Symbol
            string memory symbol,
            address[] memory allowedContracts,
            // [0] Manager address
            // [1] Token Source to be Cloned
            // [2..n] Member Addresses
            address[] memory addresses,
            // [0] Members size,
            // [1] Voting period in days
            // [2..n] Member shares 
            uint256[] memory settings				
        ) = abi.decode(pluginData, (string, string, address[], address[], uint256[]));

        if(governorsDeployed[seriesId] != address(0)) 
            revert EntityAlreadyExists();
        
        ISeriesToken newToken = ISeriesToken(Clones.clone(addresses[1]));
        IOtoCoGovernor newGovernor = IOtoCoGovernor(Clones.clone(governorContract));
		newToken.initialize(name, symbol);
		
        // Count the amount of members to assign balances
		uint256 index = settings[0];
        while (index > 0) {
        	// Members start at addresses index 2
        	// Shares start at settings index 2
            newToken.mint(addresses[index+1], settings[index+1]);
            --index;
        }

        // Transfer ownership of the token to Governor contract
        newToken.transferOwnership(address(newGovernor));
        // Initialize governor
        newGovernor.initialize(address(newToken), addresses[0], allowedContracts, settings[1], name);
        governorsDeployed[seriesId] = address(newGovernor);
        
        emit Tokenized(seriesId, address(newGovernor));
    }

    /**
    * Attaching a pre-existing token to the entity. May only be called by the entity owner.
    *
    * @param pluginData Encoded parameters to create a new token.
    * @dev seriesId Series to remove token from
    * @dev newToken Token address to be attached
     */
    function attachPlugin(uint256 seriesId, bytes calldata pluginData) 
    public onlySeriesOwner(seriesId) transferFees() payable override 
    {
        (
            address[] memory allowedContracts,
            // [0] Manager address
            // [1] Token Address to attach
            address[] memory addresses,
            // [0] Members size,
            // [1] Voting period in days
            uint256[] memory settings               
        ) = abi.decode(pluginData, (address[], address[], uint256[]));

        if(governorsDeployed[seriesId] != address(0)) 
            revert EntityAlreadyExists();
        
        ISeriesToken token = ISeriesToken(addresses[1]);
        IOtoCoGovernor newGovernor = IOtoCoGovernor(Clones.clone(governorContract));
        
        // Initialize governor
        newGovernor.initialize(address(token), addresses[0], allowedContracts, settings[1], token.name());
        governorsDeployed[seriesId] = address(newGovernor);
        
        emit Tokenized(seriesId, address(newGovernor));
    }

    /**
    * Remove Tokenization Contract from entity
    *
    * @param pluginData Encoded parameters to create a new token.
    * @dev seriesId Series to remove token from
    * @dev toRemove Token index to be removed
     */
    function removePlugin(uint256 seriesId, bytes calldata pluginData) 
    public onlySeriesOwner(seriesId) transferFees() payable override 
    {
        if(governorsDeployed[seriesId] == address(0)) 
            revert EntityInexistent();
        
        governorsDeployed[seriesId] = address(0);

        emit Untokenized(seriesId);
    }

}