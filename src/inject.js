import React, { PropTypes } from 'react';
import hoistStatics from 'hoist-non-react-statics';
import {observer} from './observer';

/**
 * Store Injection
 */
function createStoreInjector(grabStoresFn, component, injectNames) {
  let displayName = "inject-" + (component.displayName || component.name || (component.constructor && component.constructor.name) || "Unknown");
  if (injectNames)
    displayName += "-with-" + injectNames;

  const Injector = React.createClass({
    displayName: displayName,
    render: function() {
      let newProps = {};
      for (let key in this.props) if (this.props.hasOwnProperty(key)) {
        newProps[key] = this.props[key];
      }
      var additionalProps = grabStoresFn(this.context.mobxStores || {}, newProps, this.context) || {};
      for (let key in additionalProps) {
          newProps[key] = additionalProps[key];
      }
      newProps.ref = instance => {
        this.wrappedInstance = instance;
      }

      return React.createElement(component, newProps);
    }
  });

  Injector.isInjector = true;
  Injector.contextTypes = { mobxStores: PropTypes.object };
  Injector.wrappedComponent = component;
  injectStaticWarnings(Injector, component)
  hoistStatics(Injector, component);
  return Injector;
}

function injectStaticWarnings(hoc, component) {
    if (typeof process === "undefined" || !process.env || process.env.NODE_ENV === "production")
        return;

    ['propTypes', 'defaultProps', 'contextTypes'].forEach(function (prop) {
        const propValue = hoc[prop];
        Object.defineProperty(hoc, prop, {
            set: function (_) {
                // enable for testing:
                var name = component.displayName || component.name;
                console.warn('Mobx Injector: you are trying to attach ' + prop +
                    ' to HOC instead of ' + name + '. Use `wrappedComponent` property.');
            },
            get: function () {
                return propValue;
            },
            configurable: true
        });
    });
}

function grabStoresByName(storeNames) {
  return function(baseStores, nextProps) {
    storeNames.forEach(function(storeName) {
      if (storeName in nextProps) // prefer props over stores
        return;
      if (!(storeName in baseStores))
        throw new Error("MobX observer: Store '" + storeName + "' is not available! Make sure it is provided by some Provider");
      nextProps[storeName] = baseStores[storeName];
    });
    return nextProps;
  }
}

/**
 * higher order component that injects stores to a child.
 * takes either a varargs list of strings, which are stores read from the context,
 * or a function that manually maps the available stores from the context to props:
 * storesToProps(mobxStores, props, context) => newProps
 */
export default function inject(/* fn(stores, nextProps) or ...storeNames */) {
  let grabStoresFn;
  if (typeof arguments[0] === "function") {
    grabStoresFn = arguments[0];
    return function(componentClass) {
      // mark the Injector as observer, to make it react to expressions in `grabStoresFn`,
      // see #111
      return observer(createStoreInjector(grabStoresFn, componentClass, grabStoresFn.name));
    };
  } else {
    const storeNames = [];
    for (let i = 0; i < arguments.length; i++)
      storeNames[i] = arguments[i];
    grabStoresFn = grabStoresByName(storeNames);
    return function(componentClass) {
      return createStoreInjector(grabStoresFn, componentClass, storeNames.join("_"));
    };
  }
}

