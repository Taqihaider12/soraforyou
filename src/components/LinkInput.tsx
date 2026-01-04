import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link2, Plus, Trash2 } from "lucide-react";

interface LinkInputProps {
  onAddLinks: (links: string[]) => void;
  isProcessing: boolean;
}

export function LinkInput({ onAddLinks, isProcessing }: LinkInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = () => {
    const links = inputValue
      .split(/[\n,]/)
      .map((link) => link.trim())
      .filter((link) => link.length > 0 && link.includes("sora.chatgpt.com"));

    if (links.length > 0) {
      onAddLinks(links);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      handleSubmit();
    }
  };

  const handleClear = () => {
    setInputValue("");
  };

  const linkCount = inputValue
    .split(/[\n,]/)
    .filter((link) => link.trim().includes("sora.chatgpt.com")).length;

  return (
    <div className="glass-card rounded-2xl p-6 mb-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Link2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Paste Sora Video Links</h2>
          <p className="text-sm text-muted-foreground">
            One link per line, or separate with commas
          </p>
        </div>
      </div>

      <div className="relative">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`https://sora.chatgpt.com/p/s_695acc3ba03c81918e8a97bc2c19e377?psh=...\nhttps://sora.chatgpt.com/p/s_695accb0d12c81918e3f422b996e2e39?psh=...\nhttps://sora.chatgpt.com/p/s_695acc9863dc8191866481fe021f7f25?psh=...`}
          className="w-full h-40 p-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 resize-none font-mono text-sm transition-all"
          disabled={isProcessing}
        />
        
        {inputValue && (
          <button
            onClick={handleClear}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">
          {linkCount > 0 ? (
            <span className="text-primary font-medium">{linkCount} valid link{linkCount !== 1 ? 's' : ''} detected</span>
          ) : (
            <span>Paste Sora video links to get started</span>
          )}
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="glass"
            onClick={handleClear}
            disabled={!inputValue || isProcessing}
          >
            Clear
          </Button>
          <Button
            variant="hero"
            size="lg"
            onClick={handleSubmit}
            disabled={linkCount === 0 || isProcessing}
          >
            <Plus className="w-5 h-5" />
            Add {linkCount > 0 ? linkCount : ''} Video{linkCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground/70 mt-3 text-center">
        Press <kbd className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">Enter</kbd> to add quickly
      </p>
    </div>
  );
}
