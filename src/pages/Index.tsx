import { Header } from "@/components/Header";
import { LinkInput } from "@/components/LinkInput";
import { VideoQueue } from "@/components/VideoQueue";
import { Footer } from "@/components/Footer";
import { useVideoProcessor } from "@/hooks/useVideoProcessor";

const Index = () => {
  const {
    videos,
    isProcessing,
    addVideos,
    removeVideo,
    clearAll,
    processAll,
    retryVideo,
    downloadAll,
    downloadSingle,
  } = useVideoProcessor();

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container max-w-4xl mx-auto px-4 flex-1">
        <Header />
        
        <main className="pb-8">
          <LinkInput onAddLinks={addVideos} isProcessing={isProcessing} />
          
          <VideoQueue
            videos={videos}
            onRemove={removeVideo}
            onRetry={retryVideo}
            onClearAll={clearAll}
            onProcessAll={processAll}
            onDownloadAll={downloadAll}
            onDownloadSingle={downloadSingle}
            isProcessing={isProcessing}
          />
        </main>
      </div>
      
      <Footer />
    </div>
  );
};

export default Index;
