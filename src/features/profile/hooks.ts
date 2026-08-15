import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as avatars from "../../lib/avatars";
import * as api from "./api";

export function useMyProfile(userId: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () => api.getProfile(userId as string),
    enabled: !!userId,
  });
}

function invalidateProfileQueries(queryClient: ReturnType<typeof useQueryClient>, userId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["profile", userId] });
  // A profile's avatar_url shows up embedded in project/team member lists,
  // task assignees, and comment authors — refresh those too.
  queryClient.invalidateQueries({ queryKey: ["project-members"] });
  queryClient.invalidateQueries({ queryKey: ["team-members"] });
  queryClient.invalidateQueries({ queryKey: ["task-assignees"] });
  queryClient.invalidateQueries({ queryKey: ["comments"] });
}

export function useUploadUserAvatar(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => avatars.uploadUserAvatar(userId as string, file),
    onSuccess: () => invalidateProfileQueries(queryClient, userId),
  });
}

export function useRemoveUserAvatar(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => avatars.removeUserAvatar(userId as string),
    onSuccess: () => invalidateProfileQueries(queryClient, userId),
  });
}
