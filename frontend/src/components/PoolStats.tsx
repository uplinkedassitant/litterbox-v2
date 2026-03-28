import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

const POOL_PDA = import.meta.env.VITE_POOL_PDA || 'H3LwN5cS6zyX3iU8PwnDMXh4RbFAmwBKGkg81UzGuwFt';

interface PoolData {
  virtualLitter: bigint;
  virtualUsdc: bigint;
  realLitter: bigint;
  realUsdc: bigint;
  isActive: boolean;
  exists: boolean;
}

export function PoolStats() {
  const { connection } = useConnection();
  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPoolData = async () => {
      try {
        const poolPubkey = new PublicKey(POOL_PDA);
        const info = await connection.getAccountInfo(poolPubkey);
        
        if (info && info.data.length === 40) {
          const virtualLitter = info.data.readBigUInt64LE(0);
          const virtualUsdc = info.data.readBigUInt64LE(8);
          const realLitter = info.data.readBigUInt64LE(16);
          const realUsdc = info.data.readBigUInt64LE(24);
          const isActive = info.data[32] === 1;

          setPoolData({
            virtualLitter,
            virtualUsdc,
            realLitter,
            realUsdc,
            isActive,
            exists: true,
          });
        } else {
          setPoolData({
            virtualLitter: 0n,
            virtualUsdc: 0n,
            realLitter: 0n,
            realUsdc: 0n,
            isActive: false,
            exists: false,
          });
        }
      } catch (err) {
        console.error('Error fetching pool data:', err);
        setPoolData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPoolData();
    const interval = setInterval(fetchPoolData, 3000); // Refresh every 3s
    return () => clearInterval(interval);
  }, [connection]);

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
        <h2 className="text-2xl font-bold text-white mb-4">📊 Pool Statistics</h2>
        <p className="text-purple-200">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
      <h2 className="text-2xl font-bold text-white mb-4">📊 Pool Statistics</h2>
      
      {!poolData || !poolData.exists ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-yellow-400 font-bold mb-2">Pool Not Initialized!</p>
          <p className="text-purple-300 text-sm mb-4">
            The pool needs to be initialized before swapping.
          </p>
          <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-200 px-4 py-3 rounded-lg text-sm">
            <p className="font-bold mb-2">To initialize the pool:</p>
            <ol className="text-left list-decimal list-inside space-y-1">
              <li>Run the init script: <code className="bg-black/20 px-2 py-1 rounded">node scripts/init-pool.js</code></li>
              <li>Or call the initialize instruction from your wallet</li>
              <li>Wait for confirmation</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-purple-300 text-sm">Status</p>
            <p className={`text-lg font-semibold ${poolData.isActive ? 'text-green-400' : 'text-yellow-400'}`}>
              {poolData.isActive ? '✅ Active' : '⏸️ Inactive (needs first deposit)'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-purple-300 text-sm">Virtual USDC</p>
              <p className="text-xl font-mono text-white">
                {(Number(poolData.virtualUsdc) / 1_000_000_000).toFixed(2)}
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-purple-300 text-sm">Virtual $LITTER</p>
              <p className="text-xl font-mono text-white">
                {(Number(poolData.virtualLitter) / 1_000_000_000).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-purple-300 text-sm">Real USDC</p>
              <p className="text-xl font-mono text-white">
                {(Number(poolData.realUsdc) / 1_000_000_000).toFixed(2)}
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-purple-300 text-sm">Real $LITTER</p>
              <p className="text-xl font-mono text-white">
                {(Number(poolData.realLitter) / 1_000_000_000).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="bg-purple-600/20 rounded-lg p-4 border border-purple-500/30">
            <p className="text-purple-200 text-sm">Current Price</p>
            <p className="text-2xl font-bold text-white">
              {poolData.virtualUsdc > 0n
                ? (Number(poolData.virtualLitter) / Number(poolData.virtualUsdc)).toFixed(4)
                : '0.0000'}{' '}
              $LITTER/USDC
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
