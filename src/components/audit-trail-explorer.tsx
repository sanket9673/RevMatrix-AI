"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Hash,
  Database,
  UserCheck,
  ArrowRight,
  Copy,
  Check,
  Eye,
  Loader2,
  Lock,
  GitCommit,
  CheckCircle2
} from "lucide-react";
import {
  MOCK_AUDIT_BLOCKS,
  AuditBlock
} from "@/types/reasoning-audit";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

// Web Crypto SHA-256 helper
async function calculateSHA256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

export function AuditTrailExplorer() {
  const [blocks, setBlocks] = React.useState<AuditBlock[]>(
    MOCK_AUDIT_BLOCKS.map(b => ({ ...b, verified: false }))
  );
  
  const [searchQuery, setSearchQuery] = React.useState("");
  const [actorFilter, setActorFilter] = React.useState<string>("ALL");
  const [selectedBlock, setSelectedBlock] = React.useState<AuditBlock | null>(null);
  
  // Interactive detail verification state
  const [isVerifyingBlock, setIsVerifyingBlock] = React.useState(false);
  const [blockVerificationResult, setBlockVerificationResult] = React.useState<'SUCCESS' | 'FAILED' | null>(null);
  const [computedBlockHash, setComputedBlockHash] = React.useState<string>("");

  // Ledger-wide chain verification state
  const [isVerifyingLedger, setIsVerifyingLedger] = React.useState(false);
  const [ledgerVerificationIndex, setLedgerVerificationIndex] = React.useState<number>(-1);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredBlocks = React.useMemo(() => {
    return blocks.filter((b) => {
      const matchesSearch =
        b.workflowId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.currentHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.actionExecuted.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesActor =
        actorFilter === "ALL" || b.actor === actorFilter;
      
      return matchesSearch && matchesActor;
    });
  }, [blocks, searchQuery, actorFilter]);

  // Handle single block live hash recalculation
  const handleVerifyBlock = async (block: AuditBlock) => {
    setIsVerifyingBlock(true);
    setBlockVerificationResult(null);
    setComputedBlockHash("");
    
    // Simulate hashing latency for visual effect
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    try {
      const dataToHash = block.prevHash + JSON.stringify(block.payload) + block.timestamp;
      const hash = await calculateSHA256(dataToHash);
      setComputedBlockHash(hash);
      
      if (hash === block.currentHash) {
        setBlockVerificationResult("SUCCESS");
        // Update local block status
        setBlocks(prev =>
          prev.map(b => (b.blockHeight === block.blockHeight ? { ...b, verified: true } : b))
        );
      } else {
        setBlockVerificationResult("FAILED");
      }
    } catch (err) {
      console.error(err);
      setBlockVerificationResult("FAILED");
    } finally {
      setIsVerifyingBlock(false);
    }
  };

  // Verify the entire ledger chain (hashing Block 0 through N and validating links)
  const handleVerifyLedger = async () => {
    setIsVerifyingLedger(true);
    setLedgerVerificationIndex(-1);
    
    // Reset all blocks verified status
    setBlocks(prev => prev.map(b => ({ ...b, verified: false })));
    
    let isChainValid = true;
    for (let i = 0; i < blocks.length; i++) {
      setLedgerVerificationIndex(i);
      await new Promise(resolve => setTimeout(resolve, 500)); // Delay per block
      
      const block = blocks[i];
      const dataToHash = block.prevHash + JSON.stringify(block.payload) + block.timestamp;
      const calculatedHash = await calculateSHA256(dataToHash);
      
      // Verification rules:
      // 1. Current calculated hash matches currentHash
      // 2. If height > 0, prevHash must match previous block's currentHash
      const hashMatches = calculatedHash === block.currentHash;
      const linkMatches = i === 0 || block.prevHash === blocks[i - 1].currentHash;
      
      if (hashMatches && linkMatches) {
        setBlocks(prev =>
          prev.map(b => (b.blockHeight === block.blockHeight ? { ...b, verified: true } : b))
        );
      } else {
        isChainValid = false;
        break;
      }
    }
    
    setLedgerVerificationIndex(-1);
    setIsVerifyingLedger(false);
  };

  const getActorBadge = (actor: string) => {
    switch (actor) {
      case "AGENT_GEMINI":
        return (
          <Badge variant="purple" className="gap-1 border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
            <Database className="h-3 w-3" />
            AGENT_GEMINI
          </Badge>
        );
      case "POLICY_ENGINE":
        return (
          <Badge variant="info" className="gap-1 border-sky-500/20 bg-sky-500/10 text-sky-400">
            <Lock className="h-3 w-3" />
            POLICY_ENGINE
          </Badge>
        );
      case "HUMAN_OVERRIDE":
        return (
          <Badge variant="warning" className="gap-1 border-amber-500/20 bg-amber-500/10 text-amber-400">
            <UserCheck className="h-3 w-3 text-amber-400" />
            HUMAN_OVERRIDE
          </Badge>
        );
      default:
        return <Badge>{actor}</Badge>;
    }
  };

  const totalVerifiedCount = React.useMemo(() => {
    return blocks.filter((b) => b.verified).length;
  }, [blocks]);

  return (
    <div className="space-y-6">
      {/* Live Hash Chain Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-zinc-800 bg-zinc-900/10 backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 font-mono font-medium tracking-wide uppercase">
                Total Chain Height
              </span>
              <div className="text-xl font-bold text-zinc-100 font-mono">
                #{blocks.length - 1} <span className="text-xs text-zinc-500 font-normal">({blocks.length} Blocks)</span>
              </div>
            </div>
            <div className="h-9 w-9 rounded-lg bg-zinc-800/40 border border-zinc-750 flex items-center justify-center">
              <GitCommit className="h-5 w-5 text-zinc-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/10 backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 font-mono font-medium tracking-wide uppercase">
                Verified Integrity
              </span>
              <div className={cn(
                "text-xl font-bold font-mono transition-colors",
                totalVerifiedCount === blocks.length ? "text-emerald-400" : "text-amber-400"
              )}>
                {Math.round((totalVerifiedCount / blocks.length) * 100)}% Verified
              </div>
            </div>
            <div className="h-9 w-9 rounded-lg bg-zinc-800/40 border border-zinc-750 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/10 backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 font-mono font-medium tracking-wide uppercase">
                Last Block Timestamp
              </span>
              <div className="text-sm font-bold text-zinc-300 font-mono truncate max-w-[180px]" suppressHydrationWarning>
                {new Date(blocks[blocks.length - 1].timestamp).toLocaleTimeString()} (Today)
              </div>
            </div>
            <div className="h-9 w-9 rounded-lg bg-zinc-800/40 border border-zinc-750 flex items-center justify-center">
              <RefreshCw className="h-4.5 w-4.5 text-zinc-400" />
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleVerifyLedger}
          loading={isVerifyingLedger}
          variant="emerald"
          className="h-full py-4 text-xs tracking-wider uppercase font-semibold cursor-pointer shadow-emerald-500/10"
        >
          <ShieldCheck className="h-4 w-4 mr-2" />
          Verify Entire Ledger
        </Button>
      </div>

      {/* Ledger Verification Scan Progress */}
      {isVerifyingLedger && (
        <Card className="border-emerald-500/20 bg-emerald-500/[0.01] animate-pulse">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-zinc-200">
                  Verifying Cryptographic Ledger Chain Integrity...
                </p>
                <p className="text-xs text-zinc-500 font-mono">
                  Recalculating hash pointer sequences on-the-fly via SubtleCrypto.
                </p>
              </div>
            </div>
            <div className="text-sm font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Validating Block #{ledgerVerificationIndex}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter and Search Controls */}
      <Card className="border-zinc-800 bg-zinc-900/15 backdrop-blur-md">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Workflow ID, Hash, Action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 bg-zinc-950/80 border border-zinc-850 rounded-lg pl-10 pr-4 text-zinc-200 text-sm font-medium placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Filter className="h-4 w-4 text-zinc-400" />
            <div className="relative flex-1 md:flex-initial">
              <select
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className="w-full md:w-56 h-10 bg-zinc-950/80 border border-zinc-850 rounded-lg px-3.5 py-2 text-zinc-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
              >
                <option value="ALL">All Actors</option>
                <option value="AGENT_GEMINI">AGENT_GEMINI</option>
                <option value="POLICY_ENGINE">POLICY_ENGINE</option>
                <option value="HUMAN_OVERRIDE">HUMAN_OVERRIDE</option>
              </select>
              <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-400 w-0 h-0" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card className="border-zinc-800 bg-zinc-900/10 backdrop-blur-md overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm min-w-[1000px]">
            <thead className="border-b border-zinc-800 bg-zinc-900/40 text-xs font-bold font-mono tracking-wider text-zinc-400 uppercase">
              <tr>
                <th className="px-5 py-4"># Height</th>
                <th className="px-5 py-4">Timestamp</th>
                <th className="px-5 py-4">Workflow ID</th>
                <th className="px-5 py-4">Actor</th>
                <th className="px-5 py-4">Action Executed</th>
                <th className="px-5 py-4">Payload SHA-256</th>
                <th className="px-5 py-4 text-center">Chain Integrity</th>
                <th className="px-5 py-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850/60 bg-zinc-950/10">
              {filteredBlocks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-zinc-500 font-mono">
                    No matching audit blocks found in the chain.
                  </td>
                </tr>
              ) : (
                filteredBlocks.map((block) => (
                  <tr
                    key={block.blockHeight}
                    className="hover:bg-zinc-900/30 transition-colors group"
                  >
                    <td className="px-5 py-4 font-mono font-bold text-zinc-300">
                      Block #{block.blockHeight}
                    </td>
                    <td className="px-5 py-4 text-zinc-400 text-xs font-mono" suppressHydrationWarning>
                      {new Date(block.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-5 py-4 font-mono font-semibold text-zinc-300">
                      {block.workflowId}
                    </td>
                    <td className="px-5 py-4">
                      {getActorBadge(block.actor)}
                    </td>
                    <td className="px-5 py-4 text-zinc-200 font-medium">
                      {block.actionExecuted}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-850 px-2 py-0.5 rounded">
                          {block.currentHash.substring(0, 6)}...{block.currentHash.substring(block.currentHash.length - 6)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(block.currentHash, `hash-${block.blockHeight}`)}
                          className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer active:scale-95"
                        >
                          {copiedKey === `hash-${block.blockHeight}` ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {block.verified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold font-mono text-xs bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.15)]">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          VERIFIED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-zinc-500 font-medium font-mono text-xs bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-full">
                          UNCHECKED
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedBlock(block);
                          setBlockVerificationResult(null);
                          setComputedBlockHash("");
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-all cursor-pointer active:scale-90"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!selectedBlock} onOpenChange={(open) => !open && setSelectedBlock(null)}>
        <DialogContent onClose={() => setSelectedBlock(null)} className="w-[92vw] sm:w-[95vw] max-w-lg sm:max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 z-50 shadow-2xl">
          {selectedBlock && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Hash className="h-4.5 w-4.5 text-emerald-500" />
                  Audit Proof Block Explorer
                </DialogTitle>
                <DialogDescription className="text-zinc-400 text-xs font-mono">
                  Recalculate & prove cryptographic integrity of Block #{selectedBlock.blockHeight}.
                </DialogDescription>
              </DialogHeader>

              {/* Block Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-zinc-950/50 border border-zinc-850/60 text-xs">
                <div>
                  <span className="text-zinc-500 block">Height</span>
                  <span className="font-bold text-zinc-200 font-mono">Block #{selectedBlock.blockHeight}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Timestamp</span>
                  <span className="font-semibold text-zinc-200 font-mono">{selectedBlock.timestamp}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Workflow ID</span>
                  <span className="font-bold text-zinc-200 font-mono">{selectedBlock.workflowId}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Actor Profile</span>
                  <span className="font-semibold text-zinc-200">{selectedBlock.actor}</span>
                </div>
              </div>

              {/* Hash Chain Proof Visualizer */}
              <div className="space-y-4 pt-4">
                {/* Previous Hash pointer */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-zinc-400 uppercase font-mono">
                      [-] PREVIOUS BLOCK HASH POINTER
                    </span>
                    <button
                      onClick={() => copyToClipboard(selectedBlock.prevHash, "prevHash")}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {copiedKey === "prevHash" ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  <pre className="max-w-full overflow-x-auto font-mono text-xs p-3 rounded bg-zinc-900 border border-zinc-800 whitespace-pre-wrap break-all select-all text-zinc-400">
                    <code>{selectedBlock.prevHash}</code>
                  </pre>
                </div>

                {/* Payload data */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-zinc-400 uppercase font-mono">
                      [+] CURRENT DATA PAYLOAD JSON
                    </span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(selectedBlock.payload, null, 2), "modalPayload")}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {copiedKey === "modalPayload" ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  <pre className="max-w-full overflow-x-auto font-mono text-xs p-3 rounded bg-zinc-900 border border-zinc-800 whitespace-pre-wrap break-all max-h-40 overflow-y-auto shadow-inner text-zinc-300">
                    <code>{JSON.stringify(selectedBlock.payload, null, 2)}</code>
                  </pre>
                </div>

                {/* Verification result and hash pointer */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-400 uppercase font-mono">
                      [=] RECORDED CURRENT HASH
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">SHA-256 Ledger Target</span>
                  </div>
                  <pre className="max-w-full overflow-x-auto font-mono text-xs p-3 rounded bg-zinc-900 border border-emerald-500/30 border-l-2 border-l-emerald-500 text-emerald-400 whitespace-pre-wrap break-all">
                    <code>{selectedBlock.currentHash}</code>
                  </pre>

                  {blockVerificationResult === "SUCCESS" && (
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-zinc-400 uppercase font-mono">
                          [*] COMPUTED LIVE HASH
                        </span>
                        <span className="font-mono text-[10px] text-emerald-400">Match Verified</span>
                      </div>
                      <pre className="max-w-full overflow-x-auto font-mono text-xs p-3 rounded bg-zinc-900 border border-emerald-500/20 border-l-2 border-l-emerald-450 text-emerald-400 whitespace-pre-wrap break-all">
                        <code>{computedBlockHash}</code>
                      </pre>
                    </div>
                  )}
                </div>

                {/* Recalculate Trigger & Alerts */}
                <div className="pt-2">
                  {blockVerificationResult === null ? (
                    <Button
                      onClick={() => handleVerifyBlock(selectedBlock)}
                      loading={isVerifyingBlock}
                      variant="emerald"
                      className="w-full text-xs font-bold uppercase tracking-wider h-11 cursor-pointer"
                    >
                      <ShieldCheck className="h-4.5 w-4.5 mr-2" />
                      Re-calculate & Verify Hash
                    </Button>
                  ) : blockVerificationResult === "SUCCESS" ? (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm flex items-start gap-3 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-emerald-300">
                          CRYPTO MATCH CONFIRMED
                        </p>
                        <p className="text-zinc-400 text-xs leading-relaxed">
                          SHA-256 hash matches ledger record exactly. Cryptographic integrity of the state and parameters validated successfully.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm flex items-start gap-3 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                      <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-rose-300">
                          VERIFICATION FAILURE
                        </p>
                        <p className="text-zinc-400 text-xs leading-relaxed">
                          Computed SHA-256 hash pointer does not match ledger record! The payload, previous block hash, or timestamp has been modified.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
