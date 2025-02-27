import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePrivy, useFundWallet } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { base } from "viem/chains";
import { formatUnits, parseUnits } from "viem";
import { createPublicClient, http } from "viem";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface Bill {
  id: string;
  vendor: string;
  amount: number;
  receivedDate: Date;
  dueDate: Date;
  status: 'UNPAID' | 'PENDING' | 'PAID';
}

interface TopUp {
  id: string;
  amount: number;
  method: 'ACH' | 'CARD';
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  date: Date;
}

const MOCK_BILLS: Bill[] = [{
  id: '1',
  vendor: 'Acme Limited',
  amount: 1500.00,
  receivedDate: new Date(2024, 2, 1),
  dueDate: new Date(2024, 3, 15),
  status: 'UNPAID'
}, {
  id: '2',
  vendor: 'SpaceX',
  amount: 8500.00,
  receivedDate: new Date(2024, 2, 5),
  dueDate: new Date(2024, 3, 20),
  status: 'PENDING'
}, {
  id: '3',
  vendor: 'Campbell Soup',
  amount: 2400.00,
  receivedDate: new Date(2024, 2, 1),
  dueDate: new Date(2024, 3, 10),
  status: 'PAID'
}];

const USDC_ABI = [{
  "inputs": [{"name": "account", "type": "address"}],
  "name": "balanceOf",
  "outputs": [{"name": "", "type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
}] as const;

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    ready,
    authenticated,
    user,
    logout
  } = usePrivy();
  const { toast } = useToast();
  const { fundWallet } = useFundWallet();
  const [balance, setBalance] = useState<string>("0");
  const [bridgeAmount, setBridgeAmount] = useState("");
  const [isBridging, setIsBridging] = useState(false);
  const [topUps, setTopUps] = useState<TopUp[]>([]);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://base-mainnet.infura.io/v3/2438b59c8f314b768531a7abb4039f84')
  });

  useEffect(() => {
    if (ready && !authenticated) {
      navigate("/");
    }
  }, [ready, authenticated, navigate]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (user?.wallet?.address) {
        try {
          const usdcBalance = await publicClient.readContract({
            address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [user.wallet.address as `0x${string}`]
          });
          
          const formattedBalance = parseFloat(formatUnits(usdcBalance, 6)).toFixed(2);
          setBalance(formattedBalance);
        } catch (error) {
          console.error("Error fetching USDC balance:", error);
          toast({
            title: "Error",
            description: "Failed to fetch USDC balance",
            variant: "destructive"
          });
        }
      }
    };
    fetchBalance();
    const intervalId = setInterval(fetchBalance, 30000);
    return () => clearInterval(intervalId);
  }, [user?.wallet?.address, publicClient, toast]);

  const handleBridgeFunding = async () => {
    if (!user?.wallet?.address || !bridgeAmount) return;
    try {
      setIsBridging(true);
      const response = await fetch('https://api.sandbox.bridge.xyz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': process.env.BRIDGE_API_KEY || '',
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          amount: bridgeAmount,
          on_behalf_of: "user_" + user.wallet.address.slice(2, 10),
          developer_fee: "0.5",
          source: {
            payment_rail: "ach_push",
            currency: "usd"
          },
          destination: {
            payment_rail: "ethereum",
            currency: "usdc",
            to_address: user.wallet.address
          }
        })
      });
      if (!response.ok) {
        throw new Error('Bridge funding failed');
      }
      const newTopUp: TopUp = {
        id: crypto.randomUUID(),
        amount: parseFloat(bridgeAmount),
        method: 'ACH',
        status: 'PENDING',
        date: new Date()
      };
      setTopUps(prev => [newTopUp, ...prev]);
      toast({
        title: "Success",
        description: "Bridge funding initiated successfully"
      });
      setBridgeAmount("");
    } catch (error) {
      console.error("Error initiating bridge funding:", error);
      toast({
        title: "Error",
        description: "Failed to initiate bridge funding",
        variant: "destructive"
      });
    } finally {
      setIsBridging(false);
    }
  };

  const handleFundWallet = () => {
    if (!user?.wallet?.address) return;
    
    const amount = bridgeAmount ? bridgeAmount : "1.00"; // Use input amount or default to 1.00
    
    const newTopUp: TopUp = {
      id: crypto.randomUUID(),
      amount: parseFloat(amount),
      method: 'CARD',
      status: 'PENDING',
      date: new Date()
    };
    setTopUps(prev => [newTopUp, ...prev]);
    
    fundWallet(user.wallet.address, {
      chain: base,
      amount: amount
    });
  };

  const getStatusColor = (status: Bill['status']) => {
    switch (status) {
      case 'UNPAID':
        return 'text-red-500 bg-red-50';
      case 'PENDING':
        return 'text-gray-500 bg-gray-50';
      case 'PAID':
        return 'text-blue-500 bg-blue-50';
    }
  };

  const getTopUpStatusColor = (status: TopUp['status']) => {
    switch (status) {
      case 'PENDING':
        return 'text-yellow-500 bg-yellow-50';
      case 'COMPLETED':
        return 'text-green-500 bg-green-50';
      case 'FAILED':
        return 'text-red-500 bg-red-50';
    }
  };

  const handlePayBill = async (billId: string) => {
    if (!user?.wallet?.address) {
      toast({
        title: "Error",
        description: "No wallet connected",
        variant: "destructive"
      });
      return;
    }

    const bill = MOCK_BILLS.find(b => b.id === billId);
    if (!bill) return;

    setProcessingPayment(billId);
    
    try {
      const amountInUSDC = parseUnits(bill.amount.toString(), 6);
      
      const txRequest = {
        chainId: base.id,
        to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        data: '0x',
        value: amountInUSDC
      };
      
      const txnHash = await user.wallet.write(txRequest);

      toast({
        title: "Payment Sent",
        description: `Payment of $${bill.amount} is being processed. Transaction: ${txnHash}`
      });

      const updatedBills = MOCK_BILLS.map(b => 
        b.id === billId ? { ...b, status: 'PENDING' as const } : b
      );
      // Note: In a real app, you would update this in your backend

    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Payment Failed",
        description: "Failed to process payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessingPayment(null);
    }
  };

  const usdBalance = parseFloat(balance);
  const usdcBalance = balance;

  if (!ready || !authenticated) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>;
  }

  return <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <Button variant="outline" onClick={() => logout()}>
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.4
      }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Wallet Address</h3>
            <p className="text-sm font-mono break-all">{user?.wallet?.address}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Balance</h3>
            <div className="space-y-2">
              <p className="text-2xl font-semibold text-gray-900">
                ${usdBalance.toFixed(2)} USD
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{usdcBalance} USDC</span>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-green-50 text-black">
                    <p className="max-w-[200px]">
                      When you add money to Fluida it's automatically converted to a digital currency called USDC
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Fund Wallet</h3>
            <div className="space-y-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount in USD"
                value={bridgeAmount}
                onChange={(e) => setBridgeAmount(e.target.value)}
              />
              <div className="grid grid-cols-1 gap-2">
                <Button 
                  onClick={handleBridgeFunding}
                  disabled={isBridging || !bridgeAmount}
                  className="w-full"
                >
                  {isBridging ? "Processing..." : "Top-up via ACH"}
                </Button>
                <Button 
                  onClick={handleFundWallet}
                  disabled={!bridgeAmount}
                  className="w-full"
                >
                  Top-up via card
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.4,
        delay: 0.2
      }} className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Recent Bills</h2>
          <div className="divide-y">
            {MOCK_BILLS.map(bill => <div key={bill.id} className="py-4 flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">{bill.vendor}</h3>
                  <p className="text-sm text-gray-500">
                    Due: {format(bill.dueDate, 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-gray-400">
                    Received: {format(bill.receivedDate, 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm font-medium">${bill.amount.toFixed(2)}</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bill.status)}`}>
                    {bill.status}
                  </span>
                  <Button 
                    size="sm" 
                    variant={bill.status === 'PAID' ? 'outline' : 'default'} 
                    disabled={bill.status === 'PAID' || processingPayment === bill.id} 
                    onClick={() => handlePayBill(bill.id)}
                  >
                    {processingPayment === bill.id ? 'Processing...' : bill.status === 'PAID' ? 'Paid' : 'Pay'}
                  </Button>
                </div>
              </div>)}
          </div>
        </motion.div>

        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.4,
        delay: 0.3
      }} className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Top-ups</h2>
          <div className="divide-y">
            {topUps.length === 0 ? <div className="text-center py-8 text-gray-500">
                No top-ups yet. Add funds to your wallet to see them here.
              </div> : topUps.map(topUp => <div key={topUp.id} className="py-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">
                        Top-up via {topUp.method}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTopUpStatusColor(topUp.status)}`}>
                        {topUp.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {format(topUp.date, 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                  <p className="text-sm font-medium">${topUp.amount.toFixed(2)}</p>
                </div>)}
          </div>
        </motion.div>
      </main>
    </div>;
};

export default Dashboard;
