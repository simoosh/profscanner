/**
 * Simulates a queue check for server load.
 * In a real app, this would check a Firestore document or an API endpoint.
 */
export const checkServerLoad = async (): Promise<{ isBusy: boolean; waitTimeSeconds: number }> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Randomly simulate busy state (10% chance)
  const isBusy = Math.random() < 0.1; 
  
  return {
    isBusy,
    waitTimeSeconds: isBusy ? Math.floor(Math.random() * 30) + 5 : 0
  };
};
