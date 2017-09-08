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
  render({ onChangeTrack, user }) {
    return (
      <form class="tracks-tabs" name="tracks-tabs">
        <label class="tracks-tabs__tab">
          <input
            name="css"
            value="css"
            type="radio"
            checked={user.track === 'css'}
            onChange={onChangeTrack}
          />
          <span class="tracks-tabs__tab-title">CSS</span>
        </label>
        <label class="tracks-tabs__tab">
          <input
            name="js"
            value="js"
            type="radio"
            checked={user.track === 'js'}
            onChange={onChangeTrack}
          />
          <span class="tracks-tabs__tab-title">JS</span>
        </label>
      </form>
    );
  }
}

TracksTabs.defaultProps = {
  onChangeTrack: function() {}
};