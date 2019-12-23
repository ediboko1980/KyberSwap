import React from "react";
import { connect } from "react-redux";
import { getTranslate } from "react-localize-redux";
import * as globalActions from "../../actions/globalActions";
import { getFormattedDate } from "../../utils/common";
import * as etherScanService from "../../services/etherscan/etherScanService";
import PortfolioView from "./PortfolioView";
import { groupBy, sortBy } from 'underscore';
import { convertToETHBalance, sumOfTwoNumber } from "../../utils/converter";

@connect((store) => {
  const address = store.account.account.address || '';
  return {
    tokens: store.tokens.tokens,
    account: store.account.account,
    address: address.toLowerCase(),
    translate: getTranslate(store.locale),
    global: store.global
  }
})
export default class Portfolio extends React.Component {
  constructor(props) {
    super(props);
    
    this.equityChart = React.createRef();
    this.performanceChart = React.createRef();
    
    this.state = {
      historyTxs: {},
      tokenAddresses: {},
      totalETHBalance: 0,
      availableTokens: [],
      currency: 'ETH'
    }
  }
  
  componentDidMount() {
    this.setTxHistory();
    this.setTokenAddresses();
    this.setAvailableBalanceTokens();
  }
  
  componentDidUpdate(prevProps) {
    if (this.props.address !== prevProps.address) {
      this.setTxHistory();
    }
  }
  
  setTokenAddresses() {
    const tokenAddresses = Object.values(this.props.tokens).reduce((result, token) => {
      Object.assign(result, {[token.address]: token.symbol});
      return result
    }, {});

    this.setState({ tokenAddresses: tokenAddresses });
  }
  
  async setTxHistory() {
    const address = this.props.address;
    
    if (!this.props.address) return;
    
    let txs = localStorage.getItem(`historyTxs_${address}`);
    
    if (!txs) {
      const normalTxs = await etherScanService.fetchNormalTransactions(address);
      const internalTxs = await etherScanService.fetchInternalTransactions(address);
      const erc20Txs = await etherScanService.fetchERC20Transactions(address);
      
      txs = normalTxs.concat(internalTxs).concat(erc20Txs);
      txs = this.reduceTxs(txs);
  
      localStorage.setItem(`historyTxs_${address}`, JSON.stringify(txs));
    } else {
      txs = JSON.parse(txs);
    }
  
    this.setState({ historyTxs: txs });
  }
  
  reduceTxs(txs) {
    const formattedTxs = sortBy(txs, (tx) => {
      return -tx.blockNumber;
    });
    
    return groupBy(formattedTxs, (tx) => {
      return getFormattedDate(+tx.timeStamp);
    });
  }
  
  setAvailableBalanceTokens() {
    const tokens = this.props.tokens;
    
    let availableTokens = Object.keys(tokens).filter((symbol) => {
      return tokens[symbol].balance != 0;
    }).map(function(symbol) {
      const token = tokens[symbol];
      token.balance = convertToETHBalance(token.balance, token.decimals, token.symbol, token.rate)
      return token;
    });
  
    const totalETHBalance = availableTokens.reduce((total, token) => {
      return +sumOfTwoNumber(total, token.balance);
    }, 0);
  
    availableTokens = sortBy(availableTokens, (token) => -token.balance);
    
    this.setState({
      totalETHBalance: totalETHBalance,
      availableTokens: availableTokens
    })
  }
  
  reImportWallet = () => {
    this.props.dispatch(globalActions.clearSession());
    this.props.global.analytics.callTrack("trackClickChangeWallet");
  };
  
  switchCurrency = (currency) => {
    this.setState({ currency: currency === 'ETH' ? 'USD' : 'ETH' })
  };
  
  render() {
    return (
      <PortfolioView
        ethereum={this.props.ethereum}
        account={this.props.account}
        address={this.props.address}
        translate={this.props.translate}
        reImportWallet={this.reImportWallet}
        equityChart={this.equityChart}
        performanceChart={this.performanceChart}
        historyTxs={this.state.historyTxs}
        tokenAddresses={this.state.tokenAddresses}
        availableTokens={this.state.availableTokens}
        totalETHBalance={this.state.totalETHBalance}
        currency={this.state.currency}
        switchCurrency={this.switchCurrency}
      />
    )
  }
}
