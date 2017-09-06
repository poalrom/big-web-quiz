/**
*
* Copyright 2017 CSS-Minsk-JS Conf. All rights reserved.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { h } from 'preact';
import BoundComponent from './bound-component';

export default class TracksTabs extends BoundComponent {
  render({onChangeTrack, user}) {
    return (
      <form class="track-tabs">
        <label>
          <input value="css" type="radio" checked={user.track === 'css'} onChange={onChangeTrack} />
          CSS
        </label>
        <label>
          <input value="js" type="radio" checked={user.track === 'js'} onChange={onChangeTrack} />
          JS
        </label>
      </form>
    );
  }
}

TracksTabs.defaultProps = {
  onChangeTrack: function(){}
};