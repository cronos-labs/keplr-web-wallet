import { Coin } from '../apptypes.d';
import axios from 'axios';

const getAccountCoinList = async (lcdBaseURL: string, address: string): Promise<Coin[]> => {
  const coinList: Coin[] = [];
  const limit = 20;
  let page = 0;
  while (true) {
    const bankBalanceList = await getBankBalanceList(lcdBaseURL, address, limit, page * limit);
    for (const bankBalance of bankBalanceList) {
      let humanReadableDenom = bankBalance.denom;
      if (bankBalance.denom.startsWith('ibc/')) {
        humanReadableDenom = await getIBCDenomTraces(lcdBaseURL, bankBalance.denom);
      }
      const coin: Coin = {
        denom: bankBalance.denom,
        amount: bankBalance.amount,
        humanReadableDenom,
        humanReadableAmount: bankBalance.amount,
      };
      coinList.push(coin);
    }

    if (bankBalanceList.length < limit) {
      break;
    }
    page += 1;
  }

  return coinList;
};

const getBankBalanceList = async (
  lcdBaseURL: string,
  address: string,
  limit: number,
  offset: number,
): Promise<BankBalance[]> => {
  const resp = await axios.get(
    `${lcdBaseURL}/cosmos/bank/v1beta1/balances/${address}?pagination.limit=${limit.toString()}&pagination.offset=${offset.toString()}`,
  );
  return resp.data.balances;
};

const getIBCDenomTraces = async (lcdBaseURL: string, denom: string): Promise<string> => {
  const hash = denom.slice(4);
  try {
    // ibc-go v9+ (e.g. Crypto.org Chain v8 on ibc-go v10) only serves /denoms
    const resp = await axios.get<{ denom: IBCDenom }>(
      `${lcdBaseURL}/ibc/apps/transfer/v1/denoms/${hash}`,
    );
    const { base, trace } = resp.data.denom;
    return [...trace.map((hop) => `${hop.port_id}/${hop.channel_id}`), base].join('/');
  } catch {
    // Fallback for chains still running ibc-go v8 or below
  }
  try {
    const resp = await axios.get<{ denom_trace: IBCDenomTrace }>(
      `${lcdBaseURL}/ibc/apps/transfer/v1/denom_traces/${hash}`,
    );
    return `${resp.data.denom_trace.path}/${resp.data.denom_trace.base_denom}`;
  } catch {
    // Do not fail the whole balance list because of a single unresolvable denom
    return denom;
  }
};

type BankBalance = {
  amount: string;
  denom: string;
};

type IBCDenom = {
  base: string;
  trace: {
    port_id: string;
    channel_id: string;
  }[];
};

type IBCDenomTrace = {
  path: string;
  base_denom: string;
};

export { getAccountCoinList };
