import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opens an endpoint to requests without an access token (D-12). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
