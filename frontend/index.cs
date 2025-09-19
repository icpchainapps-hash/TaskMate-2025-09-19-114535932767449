// Re-export all query hooks for backward compatibility
export * from './userQueries';
export * from './taskQueries';
export * from './offerQueries';
export * from './messageQueries';
export * from './notificationQueries';
export * from './paymentQueries';
export * from './adminQueries';
export * from './nftQueries';
export * from './feedQueries';
export * from './feedInteractionQueries';

// Import the validateTimeSlotAvailability function to make it available for offerQueries
import { 
  validateTimeSlotAvailability,
  getAvailableTimeSlots,
  getUnavailableTimeSlots,
  getTimeSlotAvailabilityStatus
} from './taskQueries';

// Re-export helper functions that are used across modules
export {
  validateTimeSlotAvailability,
  getAvailableTimeSlots,
  getUnavailableTimeSlots,
  getTimeSlotAvailabilityStatus
};
