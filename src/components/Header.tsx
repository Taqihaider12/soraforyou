import { Sparkles, Zap } from "lucide-react";

export function Header() {
  return (
    <header className="relative py-12 text-center">
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] bg-primary/10 rounded-full blur-[100px] animate-pulse-glow" />
      </div>
      
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-secondary/50 border border-border/50 text-sm text-muted-foreground">
          <Zap className="w-4 h-4 text-primary" />
          <span>Free & Unlimited • No Login Required</span>
        </div>
        
        <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
          <span className="text-gradient">Sora 2</span>{" "}
          <span className="text-foreground">Watermark Remover</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
          Remove watermarks from your Sora 2 videos in bulk.
          <br className="hidden md:block" />
          No quality loss. No resolution change. Just clean videos.
        </p>
        
        <div className="inline-flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Bulk Processing</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Original Quality</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Fast Download</span>
          </div>
        </div>
      </div>
    </header>
  );
}
