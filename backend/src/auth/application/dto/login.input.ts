/** What LoginUseCase needs: the credentials, already validated (HU-02). */
export interface LoginInput {
  email: string;
  password: string;
}
