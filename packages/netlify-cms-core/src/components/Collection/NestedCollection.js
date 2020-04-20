import React from 'react';
import { List } from 'immutable';
import { css } from '@emotion/core';
import { get, set } from 'lodash';
import { connect } from 'react-redux';
import { join } from 'path';
import { updateEntries, persistEntries } from '../../actions/entries';
import { selectEntries } from '../../reducers/entries';
import ImmutablePropTypes from 'react-immutable-proptypes';
import reactSortableTreeStyles from 'react-sortable-tree/style.css';
import SortableTree, {
  getTreeFromFlatData,
  getVisibleNodeCount,
  getFlatDataFromTree,
} from 'react-sortable-tree/dist/index.esm.js';

const customStyles = css`
  font-size: 14px;
  font-weight: 500;
  .rst__rowContents {
    min-width: 40px;
  }
`;

const getRootId = collection => `NETLIFY_CMS_${collection.get('name').toUpperCase()}_ID`;
const getKey = node => node.path;

const getTreeData = (collection, entries, expanded) => {
  const parentKey = collection.get('nested');
  const rootKey = 'NETLIFY_CMS_ROOT_COLLECTION';
  const rootId = getRootId(collection);
  const flatData = [
    { title: collection.get('label'), data: { parent: rootKey }, path: rootId, expanded },
    ...entries.toJS().map(e => ({ ...e, title: e.slug })),
  ];
  const treeData = getTreeFromFlatData({
    flatData,
    getKey,
    getParentKey: item => {
      const parent = get(item, ['data', parentKey]);
      if (parent) {
        return join(parent);
      }
      return rootId;
    },
    rootKey,
  });
  return treeData;
};

const getEntriesData = (collection, treeData) => {
  const parentKey = collection.get('nested');
  const rootId = getRootId(collection);
  return (
    getFlatDataFromTree({ treeData, getNodeKey: getKey })
      .filter(({ parentNode }) => parentNode)
      // eslint-disable-next-line no-unused-vars
      .map(({ node: { title, children, ...rest }, parentNode: { path: parent } }) => {
        const newParent = parent === rootId ? '' : parent;
        const newNode = set(rest, ['data', parentKey], newParent);
        return newNode;
      })
  );
};

class NestedCollection extends React.Component {
  static propTypes = {
    collection: ImmutablePropTypes.map.isRequired,
    entries: ImmutablePropTypes.list.isRequired,
  };

  state = { expanded: false };

  constructor(props) {
    super(props);
  }

  onChange = treeData => {
    const { collection, updateEntries } = this.props;
    const entriesData = getEntriesData(collection, treeData);
    updateEntries(this.props.collection, entriesData);
    this.setState({ expanded: treeData[0].expanded });
  };

  onMoveNode = ({ treeData }) => {
    const { collection, persistEntries } = this.props;
    const entriesData = getEntriesData(collection, treeData);
    persistEntries(this.props.collection, entriesData);
  };

  render() {
    const { collection, entries, isOpenAuthoring } = this.props;

    const treeData = getTreeData(collection, entries, this.state.expanded);

    const rowHeight = 40;
    const height = getVisibleNodeCount({ treeData }) * rowHeight;
    return (
      <div
        css={css`
          ${reactSortableTreeStyles}
          ${customStyles}
          height: ${height}px;
        `}
      >
        <SortableTree
          treeData={treeData}
          rowHeight={rowHeight}
          onChange={this.onChange}
          onMoveNode={this.onMoveNode}
          getNodeKey={({ node }) => getKey(node)}
          canDrag={({ node }) => (isOpenAuthoring ? false : node.path !== treeData[0].path)}
          canDrop={({ nextParent }) => (isOpenAuthoring ? false : nextParent !== null)}
          isVirtualized={false}
        />
      </div>
    );
  }
}

function mapStateToProps(state, ownProps) {
  const { collection } = ownProps;
  const isOpenAuthoring = state.globalUI.get('useOpenAuthoring', false);
  const entries = selectEntries(state.entries, collection.get('name')) || List();
  return { entries, isOpenAuthoring };
}

const mapDispatchToProps = {
  updateEntries,
  persistEntries,
};

export default connect(mapStateToProps, mapDispatchToProps)(NestedCollection);
