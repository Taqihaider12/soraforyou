import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-8 mt-16 border-t border-border/50">
      <div className="container max-w-4xl mx-auto px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Made with <Heart className="w-4 h-4 inline-block text-destructive mx-1" /> for Sora creators
        </p>
        <p className="text-xs text-muted-foreground/60 mt-2">
          This tool is for personal use. Please respect OpenAI's terms of service.
        </p>
      </div>
    </footer>
  );
}
