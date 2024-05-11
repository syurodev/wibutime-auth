import { Profile } from 'passport';

export const ParseGoogleProfile = (data: string | object): Profile => {
  if (typeof data === 'object') {
    return data as Profile;
  } else {
    return JSON.parse(JSON.parse(data));
  }
};
