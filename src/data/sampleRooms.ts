import { RoomType, FocusGoal } from '../types';
import homeOfficeImg from '../assets/images/sample_home_office_1794950688548.jpg';
import closetImg from '../assets/images/sample_bedroom_closet_1794950689176.jpg';
import kitchenImg from '../assets/images/sample_kitchen_counter_1794950690027.jpg';
import livingRoomImg from '../assets/images/sample_living_room_1794950689581.jpg';

export interface SampleRoom {
  id: string;
  title: string;
  roomType: RoomType;
  focusGoal: FocusGoal;
  description: string;
  imageUrl: string;
}

export const SAMPLE_ROOMS: SampleRoom[] = [
  {
    id: 'sample_office',
    title: 'Home Office Desk',
    roomType: 'home_office',
    focusGoal: 'quick_wins',
    description: 'Paper clutter, loose cables, mug stacks, and overcrowded desk space.',
    imageUrl: homeOfficeImg,
  },
  {
    id: 'sample_closet',
    title: 'Bedroom Closet',
    roomType: 'closet',
    focusGoal: 'storage_solutions',
    description: 'Overflowing clothes hangers, unstacked shoes, and mixed seasonal wear.',
    imageUrl: closetImg,
  },
  {
    id: 'sample_kitchen',
    title: 'Kitchen Countertop',
    roomType: 'kitchen',
    focusGoal: 'maximize_space',
    description: 'Appliances taking over prep areas, unsorted mail, and stray spice jars.',
    imageUrl: kitchenImg,
  },
  {
    id: 'sample_living',
    title: 'Living Room Table',
    roomType: 'living_room',
    focusGoal: 'aesthetic_reset',
    description: 'Remote controls, stacked magazines, stray decor, and charger tangles.',
    imageUrl: livingRoomImg,
  },
];
