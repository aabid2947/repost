"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap/register";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { usePostStore } from "@/lib/store/post-store";
import { postToLinkedIn } from "@/lib/actions/post-to-linkedin";
import { toast } from "sonner";
import { 
  Send, 
  Image, 
  FileText, 
  Loader2, 
  X, 
  ChevronUp, 
  ChevronDown,
  Images as ImagesIcon,
  Upload,
} from "lucide-react";

export function PostPreviewModal() {
  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const {
    isModalOpen,
    closeModal,
    draftPost,
    setDraftPost,
    selectedRepo,
    screenshots,
    addScreenshot,
    reorderScreenshots,
    removeScreenshot,
    isPosting,
    setIsPosting,
    postType,
    setPostType,
    reset,
  } = usePostStore();

  const charCount = draftPost.length;
  const isOverLimit = charCount > 3000;
  
  // Filter to only successful screenshots
  const validScreenshots = screenshots.filter((s) => s.screenshotUrl || s.fileDataUrl);
  const hasImages = validScreenshots.length > 0;
  const canAddMore = screenshots.length < 5;

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length && screenshots.length + i < 5; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image file`);
          continue;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 5MB)`);
          continue;
        }

        // Convert to data URL
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Add to screenshots
        addScreenshot({
          path: file.name,
          url: "",
          description: file.name,
          screenshotUrl: null,
          fileDataUrl: dataUrl,
          isUserUploaded: true,
        });

        toast.success(`Added ${file.name}`);
      }

      // Auto-set to image mode
      if (postType === "text") {
        setPostType("image");
      }
    } catch (error) {
      console.error("File upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Auto-set post type to image when screenshots are available
  useEffect(() => {
    if (hasImages && postType === "text") {
      console.log("[PostPreviewModal] Auto-setting postType to 'image' due to available screenshots");
      setPostType("image");
    }
  }, [hasImages, postType, setPostType]);

  // GSAP expansion animation when modal opens
  useGSAP(
    () => {
      if (!isModalOpen || !contentRef.current) return;
      gsap.fromTo(
        contentRef.current,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)" }
      );
    },
    { dependencies: [isModalOpen] }
  );

  const handlePost = async () => {
    if (!draftPost.trim()) {
      toast.error("Post content cannot be empty");
      return;
    }

    console.log("[PostPreviewModal] Posting with type:", postType);
    console.log("[PostPreviewModal] Valid screenshots:", validScreenshots.length);

    setIsPosting(true);
    try {
      // Prepare screenshots with data URLs for uploaded files
      const screenshotsToPost = postType === "image" ? validScreenshots : undefined;
      
      const result = await postToLinkedIn(
        draftPost,
        postType,
        screenshotsToPost
      );

      if (result.success) {
        toast.success("Successfully posted to LinkedIn!");
        reset();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to post to LinkedIn"
      );
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent ref={contentRef} className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Preview LinkedIn Post
            {selectedRepo && (
              <Badge variant="secondary">{selectedRepo.name}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Edit your AI-generated post and manage screenshots before publishing.
          </DialogDescription>
        </DialogHeader>

        {/* Draft Editor */}
        <div className="space-y-4">
          <Textarea
            value={draftPost}
            onChange={(e) => setDraftPost(e.target.value)}
            placeholder="Your LinkedIn post..."
            className="min-h-[180px] resize-none"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className={isOverLimit ? "text-destructive" : ""}>
              {charCount} / 3000 characters
            </span>
          </div>

          {/* Screenshots Management */}
          {hasImages && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Screenshots ({validScreenshots.length})
                </p>
                <Badge variant="outline" className="gap-1">
                  <ImagesIcon className="h-3 w-3" />
                  Reorder & remove as needed
                </Badge>
              </div>
              
              <div className="grid gap-3">
                {screenshots.map((screenshot, index) => {
                  const isValid = screenshot.screenshotUrl !== null || screenshot.fileDataUrl !== undefined;
                  const imageUrl = screenshot.fileDataUrl || screenshot.screenshotUrl;
                  
                  return (
                    <div
                      key={index}
                      className={`flex gap-3 p-3 rounded-lg border ${
                        isValid
                          ? "bg-background"
                          : "bg-muted/50 opacity-60"
                      }`}
                    >
                      {/* Screenshot Preview */}
                      <div className="w-32 h-20 flex-shrink-0 rounded overflow-hidden border bg-muted">
                        {isValid && imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={screenshot.description}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            Failed
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {screenshot.description}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {screenshot.isUserUploaded ? "User uploaded" : screenshot.path}
                        </p>
                      </div>

                      {/* Controls */}
                      {isValid && (
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => reorderScreenshots(index, index - 1)}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => reorderScreenshots(index, index + 1)}
                            disabled={index === screenshots.length - 1}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeScreenshot(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              
              {/* Upload More Images */}
              {canAddMore && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="gap-2"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Add More Images ({screenshots.length}/5)
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Upload your own images (max 5MB each)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Upload Images Section (when no screenshots) */}
          {!hasImages && (
            <div className="space-y-3 rounded-lg border border-dashed p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Upload Images</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add up to 5 images to your LinkedIn post
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagesIcon className="h-4 w-4" />
                )}
                Choose Images
              </Button>
            </div>
          )}

          {/* Post Type Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={postType === "text" ? "default" : "outline"}
              size="sm"
              onClick={() => setPostType("text")}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Text Only
            </Button>
            <Button
              variant={postType === "image" ? "default" : "outline"}
              size="sm"
              onClick={() => setPostType("image")}
              disabled={!hasImages}
              className="gap-2"
            >
              <Image className="h-4 w-4" />
              {validScreenshots.length > 1 
                ? `With ${validScreenshots.length} Images` 
                : "With Image"}
            </Button>
            {!hasImages && (
              <span className="text-xs text-muted-foreground">
                No screenshots available
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={closeModal} disabled={isPosting}>
            Cancel
          </Button>
          <Button
            onClick={handlePost}
            disabled={isPosting || isOverLimit || !draftPost.trim()}
            className="gap-2"
          >
            {isPosting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isPosting ? "Posting..." : "Post to LinkedIn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
