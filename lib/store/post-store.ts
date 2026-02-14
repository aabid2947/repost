import { create } from "zustand";

interface RepoInfo {
  name: string;
  owner: string;
  url: string;
  description: string | null;
  homepage: string | null;
}

export interface PageScreenshot {
  path: string;
  url: string;
  description: string;
  screenshotUrl: string | null;
  file?: File; // For user-uploaded images
  isUserUploaded?: boolean;
  fileDataUrl?: string; // Base64 data URL for user-uploaded files
}

interface PostStore {
  // State
  isModalOpen: boolean;
  draftPost: string;
  selectedRepo: RepoInfo | null;
  screenshotUrl: string | null; // Deprecated, kept for backward compatibility
  screenshots: PageScreenshot[]; // New: multiple screenshots
  isGenerating: boolean;
  isPosting: boolean;
  postType: "text" | "image";

  // Actions
  openModal: () => void;
  closeModal: () => void;
  setDraftPost: (draft: string) => void;
  setSelectedRepo: (repo: RepoInfo) => void;
  setScreenshotUrl: (url: string | null) => void; // Deprecated
  setScreenshots: (screenshots: PageScreenshot[]) => void;
  addScreenshot: (screenshot: PageScreenshot) => void;
  reorderScreenshots: (startIndex: number, endIndex: number) => void;
  removeScreenshot: (index: number) => void;
  setIsGenerating: (val: boolean) => void;
  setIsPosting: (val: boolean) => void;
  setPostType: (type: "text" | "image") => void;
  reset: () => void;
}

const initialState = {
  isModalOpen: false,
  draftPost: "",
  selectedRepo: null as RepoInfo | null,
  screenshotUrl: null as string | null,
  screenshots: [] as PageScreenshot[],
  isGenerating: false,
  isPosting: false,
  postType: "text" as const,
};

export const usePostStore = create<PostStore>((set) => ({
  ...initialState,
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
  setDraftPost: (draftPost) => set({ draftPost }),
  setSelectedRepo: (selectedRepo) => set({ selectedRepo }),
  setScreenshotUrl: (screenshotUrl) => set({ screenshotUrl }),
  setScreenshots: (screenshots) => set({ screenshots }),
  addScreenshot: (screenshot) =>
    set((state) => {
      // Limit to 5 total images
      if (state.screenshots.length >= 5) return state;
      return { screenshots: [...state.screenshots, screenshot] };
    }),
  reorderScreenshots: (startIndex, endIndex) =>
    set((state) => {
      const result = Array.from(state.screenshots);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return { screenshots: result };
    }),
  removeScreenshot: (index) =>
    set((state) => ({
      screenshots: state.screenshots.filter((_, i) => i !== index),
    })),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setIsPosting: (isPosting) => set({ isPosting }),
  setPostType: (postType) => set({ postType }),
  reset: () => set(initialState),
}));
