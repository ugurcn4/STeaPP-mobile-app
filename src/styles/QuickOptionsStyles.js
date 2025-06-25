import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const itemWidth = (width - 60) / 3; // 3 sütunlu grid, biraz daha geniş ikonlar

export default StyleSheet.create({
  containerWrapper: {
    marginHorizontal: 20,
    marginTop: 5,
    marginBottom: 5, // Daha geniş alt boşluk
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  optionItem: {
    width: itemWidth,
    marginBottom: 25,
    alignItems: 'center',
  },
  highlightedItem: {
    transform: [{scale: 1.08}],
  },
  iconWrapper: {
    width: 70,
    height: 70,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: -10,
    right: -10,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  
  // Arkadaşlık istekleri modalı stilleri
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#252636',
    width: '90%',
    height: '70%',
    borderRadius: 20,
    padding: 20,
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E5E5E9',
  },
  requestsList: {
    flex: 1,
  },
  requestCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    backgroundColor: '#32323E',
    borderRadius: 15,
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#AE63E4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E5E9',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
  },
  acceptButton: {
    backgroundColor: 'rgba(68, 215, 182, 0.15)',
    borderColor: 'rgba(68, 215, 182, 0.3)',
  },
  rejectButton: {
    backgroundColor: 'rgba(255, 107, 120, 0.15)',
    borderColor: 'rgba(255, 107, 120, 0.3)',
  },
  loader: {
    marginTop: 30,
  },
  emptyText: {
    color: '#9797A9',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 30,
  }
}); 