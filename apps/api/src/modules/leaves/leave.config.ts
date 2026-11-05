export interface LeaveAllowances {
  casualDays: number;
  sickDays: number;
  annualDays: number;
}

export const LEAVE_CONFIG = {
  DEFAULT_ALLOWANCES: {
    casualDays: 12,
    sickDays: 12,
    annualDays: 15,
  } as LeaveAllowances,
  PAST_LEAVE_GRACE_DAYS: 7,
};
