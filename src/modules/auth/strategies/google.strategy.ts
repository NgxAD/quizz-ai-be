import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../../schemas/user.schema';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['profile', 'email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { id, displayName, emails, photos } = profile;

      let user = await this.userModel.findOne({ googleId: id });

      if (!user) {
        user = await this.userModel.create({
          googleId: id,
          googleEmail: emails[0].value,
          email: emails[0].value,
          fullName: displayName,
          avatar: photos[0].value,
          password: null,
        });
      }

      const payload = {
        googleId: user.googleId,
        email: user.email,
        fullName: user.fullName,
      };

      done(null, payload);
    } catch (error) {
      done(error, false);
    }
  }
}
