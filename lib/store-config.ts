export const STORE_CONFIG = {
  name: 'SiBantu',
  adminPhoneDisplay: '0852-7313-9959',
  adminPhoneInternational: '6285273139959',
  pickupName: 'Pasar Inpres',
  pickupAddress: 'Pasar Inpres, Desa Kepala Pasar, Kecamatan Kaur Selatan',
  deliveryArea: 'Kaur Selatan dan sekitarnya',
  deliveryFee: 5000,
  paymentMethod: 'COD / bayar saat pesanan diterima',
};

export function adminWhatsAppUrl(message: string) {
  return `https://wa.me/${STORE_CONFIG.adminPhoneInternational}?text=${encodeURIComponent(message)}`;
}
