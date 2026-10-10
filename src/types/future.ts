/** Reserved Phase G contracts ONLY. No collections, endpoints or writes exist. */
export interface RecoveryRecord {
    id: string;
    planId: string;
    patientId: string;
    createdAt: Date; /** Inherit exactly from DischargePlan; never slide on updates. */
    expiresAt: Date;
}
export interface RecoveryTask extends RecoveryRecord {
    description: string;
    completedAt?: Date;
}
export interface CheckIn extends RecoveryRecord {
    response: string;
}
export interface PatientSymptom extends RecoveryRecord {
    description: string;
}
export interface MedicationTracking extends RecoveryRecord {
    medicationReference: string;
    confirmedAt?: Date;
}
export interface CaregiverInvite extends RecoveryRecord {
    invitationHash: string;
}
export interface CaregiverLink extends RecoveryRecord {
    caregiverIdentity: string;
}
export interface ChatHistory extends RecoveryRecord {
    messages: {
        role: string;
        content: string;
    }[];
}
