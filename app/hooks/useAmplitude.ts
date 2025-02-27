import { useEffect } from 'react';
import { amplitudeAnalytics } from '../analytics/amplitude';

export const useAmplitude = () => {
  useEffect(() => {
    amplitudeAnalytics.init();
  }, []);

  const trackEvent = (
    eventName: string, 
    eventProperties?: Record<string, any>
  ) => {
    amplitudeAnalytics.trackEvent(eventName, eventProperties);
  };

  const setUserProperties = (properties: Record<string, any>) => {
    amplitudeAnalytics.setUserProperties(properties);
  };

  const setUserId = (userId: string) => {
    amplitudeAnalytics.setUserId(userId);
  };

  return {
    trackEvent,
    setUserProperties,
    setUserId
  };
}; 