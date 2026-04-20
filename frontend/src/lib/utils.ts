/**
 * Safely ensures the provided data is returned as an array.
 * If the data is not an array, returns an empty array.
 * 
 * Used globally to prevent ".map is not a function" runtime errors.
 */
export const safeArray = <T>(data: T[] | any): T[] => {
  return Array.isArray(data) ? data : [];
};

/**
 * Validates if a message is within the 20-minute editing window.
 */
export const isEditable = (createdAt: string): boolean => {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const diffInMinutes = (now.getTime() - createdDate.getTime()) / (1000 * 60);
  return diffInMinutes <= 20;
};
