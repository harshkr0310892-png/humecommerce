import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from './useCustomerAuth';

export const useBanCheck = () => {
  const { user, profile } = useCustomerAuth();
  const [isBanned, setIsBanned] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkBanStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const email = user.email;
      const phone = profile?.phone;

      if (!email && !phone) {
        setLoading(false);
        return;
      }

      try {
        let query = supabase
          .from('banned_users')
          .select('id')
          .eq('is_active', true);

        const conditions = [];
        if (email) conditions.push(`email.eq.${email}`);
        if (phone) conditions.push(`phone.eq.${phone}`);

        if (conditions.length > 0) {
          query = query.or(conditions.join(','));
          const { data, error } = await query;
          
          if (error) {
            console.error('Error checking ban status:', error);
          } else {
            setIsBanned(data && data.length > 0);
          }
        }
      } catch (error) {
        console.error('Error in ban check:', error);
      } finally {
        setLoading(false);
      }
    };

    checkBanStatus();
  }, [user, profile]);

  return { isBanned, loading };
};

export const checkIsBanned = async (email?: string, phone?: string) => {
  if (!email && !phone) return false;

  try {
    let query = supabase
      .from('banned_users')
      .select('id')
      .eq('is_active', true);

    const conditions = [];
    if (email) conditions.push(`email.eq.${email}`);
    if (phone) conditions.push(`phone.eq.${phone}`);

    if (conditions.length > 0) {
      query = query.or(conditions.join(','));
      const { data, error } = await query;
      
      if (error) {
        console.error('Error checking ban status:', error);
        return false;
      }
      return data && data.length > 0;
    }
    return false;
  } catch (error) {
    console.error('Error in ban check:', error);
    return false;
  }
};
