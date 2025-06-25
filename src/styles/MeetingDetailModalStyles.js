import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#252636',
    width: '90%',
    height: '85%',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#32323E',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E5E5E9',
    flex: 1,
    textAlign: 'center',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Buluşma Detayları Görünümü
  detailsContainer: {
    flex: 1,
  },
  detailsContent: {
    padding: 16,
  },
  meetingHeader: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#32323E',
    padding: 16,
    borderRadius: 12,
  },
  meetingDateBadge: {
    backgroundColor: '#FFAC30',
    borderRadius: 8,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  meetingDay: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  meetingMonth: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  meetingHeaderInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  meetingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  meetingTime: {
    color: '#FFAC30',
    fontSize: 16,
    fontWeight: '600',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#32323E',
    padding: 16,
    borderRadius: 12,
  },
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 172, 48, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detailInfo: {
    flex: 1,
  },
  detailLabel: {
    color: '#9797A9',
    fontSize: 14,
    marginBottom: 4,
  },
  detailText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  sectionContainer: {
    backgroundColor: '#32323E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  participantsList: {
    marginTop: 8,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  participantAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFAC30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  participantAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  participantInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  adminBadge: {
    backgroundColor: 'rgba(255, 172, 48, 0.2)',
    color: '#FFAC30',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  
  // Katılım durumu stilleri
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    overflow: 'hidden',
  },
  acceptedBadge: {
    backgroundColor: 'rgba(68, 215, 182, 0.2)',
    color: '#44D7B6',
  },
  pendingBadge: {
    backgroundColor: 'rgba(255, 172, 48, 0.2)',
    color: '#FFAC30',
  },
  declinedBadge: {
    backgroundColor: 'rgba(255, 65, 54, 0.2)',
    color: '#FF4136',
  },
  participantActions: {
    flexDirection: 'row',
    marginTop: 5,
  },
  statusButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 8,
  },
  acceptButton: {
    backgroundColor: 'rgba(68, 215, 182, 0.2)',
  },
  declineButton: {
    backgroundColor: 'rgba(255, 65, 54, 0.2)',
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  acceptButtonText: {
    color: '#44D7B6',
  },
  declineButtonText: {
    color: '#FF4136',
  },

  participationActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  participationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 5,
  },
  participationButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  noParticipantsText: {
    color: '#9797A9',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 16,
  },
  joinButton: {
    backgroundColor: '#FFAC30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  // Düzenleme Formu
  editForm: {
    paddingBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    color: '#E5E5E9',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#32323E',
    borderRadius: 12,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  dateText: {
    backgroundColor: '#32323E',
    borderRadius: 12,
    padding: 12,
    color: '#9797A9',
    fontSize: 16,
  },
  dateHint: {
    color: '#FFAC30',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  formHint: {
    color: '#9797A9',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  timeInputContainer: {
    flexDirection: 'row',
    backgroundColor: '#32323E',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeInputField: {
    backgroundColor: '#252636',
    borderRadius: 8,
    width: 60,
    padding: 10,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  timeInputSeparator: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 10,
  },
  saveButton: {
    backgroundColor: '#FFAC30',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#FF4136',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#E5E5E9',
    fontSize: 16,
    marginTop: 16,
  },
  
  // Confirm Delete
  confirmDeleteContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmDeleteTitle: {
    color: '#FF4136',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
  },
  confirmDeleteText: {
    color: '#E5E5E9',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelDeleteButton: {
    backgroundColor: '#32323E',
  },
  confirmDeleteButton: {
    backgroundColor: '#FF4136',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmDeleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cancelDeleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
}); 